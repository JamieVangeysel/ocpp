import pino, { Logger } from 'pino'
import { RPCServer } from 'ocpp-rpc'
import RPC_Client from 'ocpp-rpc/lib/client'

const { RPCClient } = require('ocpp-rpc')

// https://github.com/mikuso/ocpp-rpc/tree/master/lib
// wss://ocpp.charge.space/ocpp
// 2203054852M

let logger: Logger

logger = pino()
logger.level = 'trace'

async function main() {
  // start rpc_client
  // start rpc_server
  const server: RPCServer = new RPCServer({
    protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
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
    console.log(`${client.session.identity} connected!`) // `XYZ123 connected!`

    let cli: RPC_Client = new RPCClient({
      endpoint: 'ws://ocpp.road.io/e-flux', // the OCPP endpoint URL
      // endpoint: 'ws://172.18.20.35:8080',
      identity: 'JV76SMPI31237773496491', // the OCPP identity
      protocols: ['ocpp1.6'],          // client understands ocpp1.6 subprotocol
      strictMode: false                // enable strict validation of requests & responses
    })
    // connect to the OCPP server
    await cli.connect()

    logger.debug('Connected to e-FLux')

    // let cli2: RPC_Client = new RPCClient({
    //   endpoint: 'wss://ocpp.charge.space/ocpp', // the OCPP endpoint URL
    //   // endpoint: 'ws://172.18.20.35:8080',
    //   identity: '2203054852M', // the OCPP identity
    //   protocols: ['ocpp1.6'],          // client understands ocpp1.6 subprotocol
    //   strictMode: false                // enable strict validation of requests & responses
    // })
    // // connect to the OCPP server
    // await cli2.connect()

    // logger.debug('Connected to ChargeAmps')

    // cli2.handle('DataTransfer', async ({ params }) => {
    //   logger.debug('Received DataTransfer from Charger', params)
    //   return await client.call('DataTransfer', params).then(() => {
    //     logger.debug('Received from ChargeAmps')
    //   })
    // })

    // create a wildcard handler to handle any RPC method
    client.handle(async ({ method, params }) => {
      // This handler will be called if the incoming method cannot be handled elsewhere.
      logger.info(`Server got ${method} from ${client.identity}:`, params)

      // try {
      //   await cli2.call(method, params).then(() => {
      //     logger.debug('Sent to ChargeAmps complete')
      //   })
      // } catch {
      //   logger.error('Error while sending to ChargeAmps!')
      // }
      try {
        const resp = await cli.call(method, params)
        logger.debug({ method, params, resp }, 'Sent to E-Flux')
        return resp
      } catch {
        logger.error('Error while sending to E-Flux!')
      }
    })
  })

  await server.listen(8080)
}

main()
