import OCPP_Client from './client'
import { cBootNotification, cHeartbeat } from './typedefs/ocpp-message'

import charge_points from './charge-points.json'

import pino, { Logger } from 'pino'

// https://github.com/mikuso/ocpp-rpc/tree/master/lib

let logger: Logger

// const targets: any[] = [
//   {
//     level: 'debug',
//     target: 'pino/file',
//     options: {
//       destination: 1
//     }
//   }
// ]

logger = pino()
logger.level = 'trace'
// pino.transport({
//   targets
// })

async function main() {
  logger.debug({ charge_points: charge_points.length }, 'main')
  // return
  for (let charge_point of charge_points) {
    let iHeartbeatInterval
    logger.debug({ charge_point: charge_point.chargePointSerialNumber }, 'Starting OCPP client for chargepoint!')
    const cli = new OCPP_Client({
      // endpoint: 'ws://ocpp.road.io/e-flux', // the OCPP endpoint URL
      endpoint: 'ws://172.18.20.35:8080',
      identity: charge_point.chargePointSerialNumber, // the OCPP identity
      protocols: ['ocpp1.6']          // client understands ocpp1.6 subprotocol
      // strictMode: false                // enable strict validation of requests & responses
    })

    logger.debug({ charge_point: charge_point.chargePointSerialNumber }, 'Connecting to backend...')
    // connect to the OCPP server
    await cli.connect()
    logger.debug({ charge_point: charge_point.chargePointSerialNumber }, 'Connected')

    // send a BootNotification request and await the response
    const bootResponse: cBootNotification = await cli.call('BootNotification', {
      chargePointModel: charge_point.chargePointModel,
      chargePointSerialNumber: charge_point.chargePointSerialNumber,
      chargePointVendor: charge_point.chargePointVendor,
      firmwareVersion: charge_point.firmwareVersion
    }) as cBootNotification

    // check that the server accepted the client
    if (bootResponse.status === 'Accepted') {
      logger.info({ charge_point: charge_point.chargePointSerialNumber, bootResponse }, 'BootNotification is accepted!')
      if (charge_point.configuration['HeartbeatInterval']) {
        const heartbeatInterval = charge_point.configuration['HeartbeatInterval'].value
        if (heartbeatInterval > 0) {
          logger.info({ charge_point: charge_point.chargePointSerialNumber }, 'Starting Heartbeat interval!')
          iHeartbeatInterval = globalThis.setInterval(() => {
            heartbeat(cli)
          }, heartbeatInterval * 1000)
        } else {
          logger.error({ heartbeatInterval }, 'Heartbeat interval value is invalid.')
        }
      }

      // send a StatusNotification request for the controller
      await cli.call('StatusNotification', {
        connectorId: 0,
        errorCode: 'NoError',
        status: 'Available'
      })

    } else {
      logger.info({ bootResponse }, 'BootNotification response is not accepted!, Handle this ...')
    }
  }
}

async function heartbeat(cli) {
  // send a Heartbeat request and await the response
  const heartbeatResponse: cHeartbeat = await cli.call('Heartbeat', {}) as cHeartbeat
  // read the current server time from the response
  logger.info({ time: heartbeatResponse.currentTime }, 'Server time is:')
}

main()
