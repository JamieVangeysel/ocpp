import pino, { type Logger } from 'pino'
import { type IHandlersOption, RPCServer } from 'ocpp-rpc'
import RPC_Client from 'ocpp-rpc/lib/client'
import { connect, MqttClient } from 'mqtt'
import type { IConfig } from './config.ts'
import { readFileSync, writeFileSync } from 'node:fs'

const { RPCClient } = require('ocpp-rpc')

// https://github.com/mikuso/ocpp-rpc/tree/master/lib
// wss://ocpp.charge.space/ocpp
// 2203054852M

let logger: Logger

let backends: { [key: string]: RPC_Client } = {}

async function main(config: IConfig) {
  logger = pino(config.logging)
  // start rpc_client
  // start rpc_server
  const server: RPCServer = new RPCServer(
    config.rpcConfig
  )

  server.auth((accept, reject, handshake) => {
    // anything passed to accept() will be attached as a 'session' property of the client.
    // sessionId: handshake.identity

    logger.debug({ handshake }, 'authenticating a new client')

    if (handshake.identity === '2203054852M') {
      logger.debug('Accepted ChargeAmps Halo')
      // accept the incoming client
      accept({})
    } else if (handshake.identity === 'JV76SMPI31237773496491') {
      logger.debug('Accepted Dummy OCPP Client')
      // accept the incoming client
      accept({})
    } else {
      if (handshake.remoteAddress === 'help') {
        reject(401, 'Unauthorized')
      }
    }
    // fallback: accept the incoming client
    accept({})
  })

  server.on('error', (err: any) => {
    logger.error({ err }, 'Connection has given an error!')
  })
  server.on('close', (err: any) => {
    logger.error({ err }, 'Connection was closed!')
  })

  server.on('client', async (client: RPC_Client) => {
    const cli_logger = logger.child({ client: client.identity })

    const ef_logger = cli_logger.child({ backend: 'e-flux' })
    const cs_logger = cli_logger.child({ backend: 'charge.space' })

    cli_logger.debug('connected!')

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

      backends[`${client.identity}-e-flux`]?.handle('ChangeConfiguration', async ({ params }: IHandlersOption): Promise<Record<string, any>> => {
        ef_logger.debug('Received ChangeConfiguration request from E-Flux OCPP, forwarding to client')
        if (client.state !== 1) {
          ef_logger.debug('Not connected, await reconnection!')
          await client.connect()
        }
        const resp: Record<string, any> = await client.call('ChangeConfiguration', params) as Record<string, any>
        ef_logger.debug({ method: 'ChangeConfiguration', params, resp }, 'Sent!')
        return resp
      })
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

      backends[`${client.identity}-charge.space`]?.handle('DataTransfer', async ({ params }: IHandlersOption): Promise<Record<string, any>> => {
        cs_logger.debug('Received DataTransfer request, forwarding to client')
        if (client.state !== 1) {
          cs_logger.debug('Not connected, await reconnection!')
          await client.connect()
        }
        const resp: Record<string, any> = await client.call('DataTransfer', params) as Record<string, any>
        cs_logger.debug({ method: 'DataTransfer', params, resp }, 'Sent!')
        return resp
      })

      backends[`${client.identity}-charge.space`]?.handle('GetConfiguration', async (): Promise<Record<string, any>> => {
        cs_logger.debug('Received GetConfiguration request, forwarding to client')
        if (client.state !== 1) {
          cs_logger.debug('Not connected, await reconnection!')
          await client.connect()
        }
        const resp = await client.call('GetConfiguration') as Record<string, any>
        cs_logger.debug({ method: 'GetConfiguration', resp }, 'Sent!')
        return resp
      })

      backends[`${client.identity}-charge.space`]?.handle('ChangeConfiguration', async ({ params }: IHandlersOption): Promise<Record<string, any>> => {
        // only accep specific keys from chargeamps as we handle management on eflux side
        const acceptedKeys = ['UserCurrentLimit', 'LightIntensity', 'Downlight', 'MeterValueSampleInterval']
        cs_logger.debug('Received ChangeConfiguration request, forwarding to client')
        if (acceptedKeys.includes(params?.key)) {
          cs_logger.debug({ key: params?.key }, `Requested update for '${params?.key}'`)
        } else {
          return {
            status: 'NotSupported'
          }
        }
        if (client.state !== 1) {
          cs_logger.debug('Not connected, await reconnection!')
          // await client.connect()
        } else {
          cs_logger.debug('Already connected!')
        }
        const resp: Record<string, any> = await client.call('ChangeConfiguration', params) as Record<string, any>
        cs_logger.debug({ method: 'ChangeConfiguration', params, resp }, 'Sent!')
        return resp
      })
    } else {
      backends[`${client.identity}-charge.space`] = new RPCClient({
        endpoint: 'wss://ocpp.charge.space/ocpp', // the OCPP endpoint URL
        identity: '2203054852M',                  // the OCPP identity
        protocols: ['ocpp1.6'],                   // client understands ocpp1.6 subprotocol
        strictMode: false                         // enable strict validation of requests & responses
      })
      cs_logger.debug('Created backend')

      backends[`${client.identity}-charge.space`]?.handle('DataTransfer', async ({ params }: IHandlersOption): Promise<Record<string, any>> => {
        cs_logger.debug('Received DataTransfer request, forwarding to client')
        if (client.state !== 1) {
          cs_logger.debug('Not connected, await reconnection!')
          // await client.connect()
        }
        return await client.call('DataTransfer', params) as Record<string, any>
      })

      backends[`${client.identity}-charge.space`]?.handle('ChangeConfiguration', async ({ params }: IHandlersOption): Promise<Record<string, any>> => {
        // only accep specific keys from chargeamps as we handle management on eflux side
        const acceptedKeys = ['UserCurrentLimit', 'LightIntensity', 'Downlight']
        cs_logger.debug('Received ChangeConfiguration request, forwarding to client')
        if (acceptedKeys.includes(params?.key)) {
          cs_logger.debug({ key: params?.key }, `Requested update for '${params?.key}'`)
        } else {
          return {
            status: 'NotSupported'
          }
        }
        if (client.state !== 1) {
          cs_logger.debug('Not connected, await reconnection!')
          // await client.connect()
        } else {
          cs_logger.debug('Already connected!')
        }
        const resp: Record<string, any> = await client.call('ChangeConfiguration', params) as Record<string, any>
        cs_logger.debug({ method: 'ChangeConfiguration', params, resp }, 'Sent!')
        return resp
      })

      backends[`${client.identity}-charge.space`]?.on('error', (err: any) => {
        cs_logger.error('Connection had error!')
      })
      backends[`${client.identity}-charge.space`]?.on('close', (err: any) => {
        cs_logger.error('Connection was closed!')
      })
    }

    const charge_amps: RPC_Client | undefined = backends[`${client.identity}-charge.space`]
    if (!charge_amps) {
      cs_logger.error('Failed to create backend')
      // throw new Error('Failed to create backend to charge.space')
    } else {
      try {
        if (charge_amps.state !== 1) {
          // connect to the OCPP server
          // cs_logger.debug('Not connected, await reconnection!')
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

    let defaultHandler = async (method: string | undefined, params?: any): Promise<any> => {
      let resp: any = Promise.resolve(undefined)
      try {
        resp = await eflux?.call(method, params)
        ef_logger.debug({ method, params, resp }, 'Sent!')
      } catch {
        ef_logger.error({ method, params }, 'Error while sending!')
      }
      return resp
    }

    // create a wildcard handler to handle any RPC method, ideal since we are passing everything on to secondary clients
    client.handle(async ({ method, params }) => {
      // This handler will be called if the incoming method cannot be handled elsewhere.
      cli_logger.info({ params }, `Server got ${method} from ${client.identity}`)

      if (mq_client.connected) {
        cli_logger.debug('Publish to MQTT')
        mq_client.publish(`ocpp/${client.identity}/${method}`, Buffer.from(JSON.stringify(params)), {
          qos: 0,
          retain: false
        })
      }

      try {
        // custom code to fix charge amps data
        let ca_params: any = Object.assign({}, params)

        switch (method) {
          case 'MeterValues':
            if (ca_params.transactionId) {
              ca_params.transactionId = txChargeAmps()
            }
            break
          case 'StopTransaction':
            if (ca_params.transactionId) {
              ca_params.transactionId = txChargeAmps()
            }
            break
        }
        charge_amps?.call(method, ca_params).then((r: any) => {
          cs_logger.debug({ method, params: ca_params, resp: r }, 'Sent!')
          if (method === 'StartTransaction') {
            writeFileSync('./tx-ca.txt', `${r.transactionId}`, { encoding: 'utf-8' })
            cs_logger.debug('Received StartTransaction result!')
          }
        })
      } catch {
        cs_logger.error('Error while sending!')
      }
      return await defaultHandler(method, params)
    })
  })

  await server.listen(config.port)
  logger.info(`Server listening on port ${config.port}!`)

  let mq_client: MqttClient = connect('mqtt://localhost:1883')
  mq_client.on('connect', () => {
    logger.info('Connected to MQTT server')
  })
}

const cfg: IConfig = JSON.parse(readFileSync('./config.json', { encoding: 'utf-8' }))

await main(cfg)

const txChargeAmps = () => {
  let transaction_id: number | undefined
  let tx = readFileSync('./tx-ca.txt', { encoding: 'utf-8' })
  if (tx && !isNaN(Number(tx))) {
    transaction_id = Number(tx)
  }
  return transaction_id
}
