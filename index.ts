import pino, { type Logger } from 'pino'
import { RPCServer } from 'ocpp-rpc'
import RPC_Client from 'ocpp-rpc/lib/client'

const { RPCClient } = require('ocpp-rpc')

// https://github.com/mikuso/ocpp-rpc/tree/master/lib
// wss://ocpp.charge.space/ocpp
// 2203054852M

let tx_chargeamps: number = 124341561
let logger: Logger

let backends: { [key: string]: RPC_Client } = {}

logger = pino({ level: 'trace' })

async function main() {
  // start rpc_client
  // start rpc_server
  const server: RPCServer = new RPCServer({
    protocols: ['ocpp1.6', 'ocpp2.0.1', 'ocpp2.1'],
    strictMode: false       // enable strict validation of requests & responses
  })

  server.auth((accept, reject, handshake) => {
    // accept the incoming client
    accept({
      // anything passed to accept() will be attached as a 'session' property of the client.
      // sessionId: handshake.identity
    })
  })

  server.on('client', async (client) => {
    const cli_logger = logger.child({ client: client.identity })
    const ef_logger = cli_logger.child({ backend: 'e-flux' })
    const cs_logger = cli_logger.child({ backend: 'charge.space' })
    cli_logger.debug('connected!') // `XYZ123 connected!`

    if (backends[`${client.identity}-e-flux`]) {
      ef_logger.debug({ backend: `${client.identity}-e-flux` },
        'Already created a backend'
      )
    } else {
      backends[`${client.identity}-e-flux`] = new RPCClient({
        endpoint: 'ws://ocpp.road.io/e-flux',           // the OCPP endpoint URL
        identity: 'JV76SMPI31237773496491',             // the OCPP identity
        protocols: ['ocpp1.6'], // client understands ocpp1.6, 2.0.1 and 2.1 subprotocol
        strictMode: false                               // enable strict validation of requests & responses
      })
      ef_logger.debug('Created backend')
    }

    const eflux: RPC_Client | undefined = backends[`${client.identity}-e-flux`]
    if (!eflux) {
      ef_logger.error('Failed to create backend')
      throw new Error('Failed to create backend to e-FLux')
    }

    try {
      if (eflux.state !== 1) {
        // connect to the OCPP server
        await eflux.connect()
        ef_logger.debug('Connected!')
      }
    } catch {
      ef_logger.debug('Failed to connect!')
    }

    if (backends[`${client.identity}-charge.space`]) {
      cs_logger.debug({ backend: `${client.identity}-charge.space` },
        'Already created a backend'
      )
    } else {
      backends[`${client.identity}-charge.space`] = new RPCClient({
        endpoint: 'wss://ocpp.charge.space/ocpp', // the OCPP endpoint URL
        identity: '2203054852M',                  // the OCPP identity
        protocols: ['ocpp1.6'],                   // client understands ocpp1.6 subprotocol
        strictMode: false                         // enable strict validation of requests & responses
      })
      cs_logger.debug('Created backend')
    }

    const charge_amps: RPC_Client | undefined = backends[`${client.identity}-charge.space`]
    if (!charge_amps) {
      cs_logger.error('Failed to create backend')
      // throw new Error('Failed to create backend to charge.space')
    } else {
      try {
        if (charge_amps.state !== 1) {
          // connect to the OCPP server
          await charge_amps.connect()
          cs_logger.debug('Connected!')
        }
      } catch {
        cs_logger.debug('Failed to connect!')
      }
    }

    // cli2.handle('DataTransfer', async ({ params }) => {
    //   logger.debug('Received DataTransfer from Charger', params)
    //   return await client.call('DataTransfer', params).then(() => {
    //     logger.debug('Received from ChargeAmps')
    //   })
    // })

    let defaultHandler = async (method: string, params?: any): Promise<any> => {
      let resp: any = Promise.resolve(undefined)
      try {
        resp = await eflux?.call(method, params)
        ef_logger.debug({ method, params, resp }, 'Sent!')
      } catch {
        ef_logger.error('Error while sending!')
      }
      return resp
    }

    // create a wildcard handler to handle any RPC method, ideal since we are passing everything on to secondary clients
    client.handle(async ({ method, params }: { method: any, params?: any }) => {
      // This handler will be called if the incoming method cannot be handled elsewhere.
      cli_logger.info(`Server got ${method} from ${client.identity}:`, params)

      try {
        // custom code to fix charge amps data
        let ca_params: any = Object.assign({}, params)

        switch (method) {
          case 'MeterValues':
            if (ca_params.transactionId) {
              ca_params.transactionId = tx_chargeamps
            }
            break
          case 'StopTransaction':
            if (ca_params.transactionId) {
              ca_params.transactionId = tx_chargeamps
            }
            break
        }
        charge_amps?.call(method, ca_params).then((r: any) => {
          cs_logger.debug({ method, params: ca_params, resp: r }, 'Sent!')
          if (method === 'StartTransaction') {
            tx_chargeamps = r.transactionId
            cs_logger.debug('Received StartTransaction result!')
          }
        })
      } catch {
        cs_logger.error('Error while sending!')
      }
      return await defaultHandler(method, params)
    })
  })

  await server.listen(8080)
  logger.info('Server listening on port 8080!')
}

await main()
