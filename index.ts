import {
  cBootNotification,
  cHeartbeat,
  cStartTransaction, cStopTransaction,
  rStartTransaction,
  rStopTransaction
} from './typedefs/ocpp-message'

import charge_points from './charge-points.json'

import pino, { Logger } from 'pino'
import { readFileSync } from 'fs'
import { appendFileSync, existsSync, writeFileSync } from 'node:fs'
import RPC_Client from 'ocpp-rpc/lib/client'

const { RPCClient } = require('ocpp-rpc')

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
    const cli: RPC_Client = new RPCClient({
      endpoint: 'ws://ocpp.road.io/e-flux', // the OCPP endpoint URL
      // endpoint: 'ws://172.18.20.35:8080',
      identity: charge_point.chargePointSerialNumber, // the OCPP identity
      protocols: ['ocpp1.6'],          // client understands ocpp1.6 subprotocol
      strictMode: false                // enable strict validation of requests & responses
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
        const heartbeatInterval = Math.min(charge_point.configuration['HeartbeatInterval'].value, bootResponse.interval)
        if (heartbeatInterval > 0) {
          heartbeat(cli).then()
          logger.info({ charge_point: charge_point.chargePointSerialNumber }, 'Starting Heartbeat interval!')
          iHeartbeatInterval = globalThis.setInterval(() => {
            heartbeat(cli).then()
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

      for (let connector of charge_point.connectors) {
        await cli.call('StatusNotification', {
          connectorId: connector.connectorId,
          errorCode: connector.errorCode,
          status: connector.status
        })
      }

      // check if there are transactions in backlog
      try {
        const txJson = readFileSync('./transactions.json', { encoding: 'utf8' })
        if (txJson) {
          const transactions: any[] = JSON.parse(txJson)
          const unsendTx = transactions.filter(e => e.id === undefined || !e.sent)
          logger.debug({ unsendTx }, 'The following transactions are stored in backlog and must be send')
          for (const tx of transactions) {
            if (tx.id && tx.sent) {
              // the transaction was already sent to server
              continue
            }
            if (!tx.id) {
              const startTx: rStartTransaction = {
                connectorId: tx.connectorId,
                idTag: tx.idTag,
                meterStart: 0,
                timestamp: tx.startTime
              }
              console.log(`Received ${tx.startTime} to ${tx.stopTime} Charge: ${tx.chargeEnergy}Wh`)
              const resp: cStartTransaction = await cli.call('StartTransaction', startTx) as cStartTransaction
              if (resp.transactionId) {
                console.debug({ transaction_id: resp.transactionId }, 'Started transaction')
                tx.id = resp.transactionId
                writeFileSync('./transactions.json', JSON.stringify(transactions), { encoding: 'utf8' })
              }
            }
            if (tx.id) {
              const stopTx: rStopTransaction = {
                transactionId: tx.id,
                meterStop: tx.chargeEnergy,
                reason: 'EVDisconnected',
                timestamp: tx.stopTime
              }
              const resp: cStopTransaction = await cli.call('StopTransaction', stopTx)
              if (resp) {
                console.debug({ transaction_id: tx.id }, 'Stopped transaction')
                tx.sent = true
                writeFileSync('./transactions.json', JSON.stringify(transactions), { encoding: 'utf8' })
              }
            }
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error while reading transactions from disk')
      }

      // start custom event watcher
      globalThis.setInterval(() => {
        checkEvents(cli, charge_point).then()
      }, 10 * 1000)
    } else {
      logger.info({ bootResponse }, 'BootNotification response is not accepted!, Handle this ...')
    }
  }
}

async function checkEvents(cli: RPC_Client, charge_point: any) {
  try {
    if (existsSync('./events.json')) {
      const eventsJson = readFileSync('./events.json', { encoding: 'utf8' })
      const events: any[] = JSON.parse(eventsJson)
      let newEvents: any[] = Array.from(events)

      for (const event of events) {
        if (event.notBefore) {
          // this is a scheduled event, CAUTION.
          if (new Date(event.notBefore).getTime() > Date.now()) {
            logger.info({
              event: event.method,
              scheduled_time: new Date(event.notBefore).getTime(),
              current_time: Date.now()
            }, 'This is a scheduled event that will be run later!')
            continue
          }
        }
        logger.debug({ event }, 'Running logic for event: ')

        const done = () => {
          newEvents.splice(newEvents.indexOf(event), 1)
          appendFileSync('./sent-events.json', JSON.stringify(event) + '\n')
        }

        switch (event.method) {
          case 'StatusNotification':
            // try to find cp en cid in config
            const con = charge_points
              .find(e => e.chargePointSerialNumber === charge_point.chargePointSerialNumber)
              .connectors
              .find(e => e.connectorId === event.payload.connectorId)
            if (con) {
              logger.debug('Found the connector!')
              try {
                await cli.call('StatusNotification', event.payload)
                con.status = event.payload.status
                con.errorCode = event.payload.errorCode
                console.log(charge_points)
                writeFileSync('./charge-points.json', JSON.stringify(charge_points))
                done()
              } catch {
                logger.error({ event }, 'Error while sending: ' + event.method)
              }
            } else {
              logger.warn('Could not find the connector!')
            }
            break

          case 'StartTransaction':
            try {
              await cli.call('StatusNotification', {
                connectorId: event.payload.connectorId,
                errorCode: 'NoError',
                status: 'Preparing'
              })
              const startTxResp: cStartTransaction = await cli.call('StartTransaction', event.payload) as cStartTransaction
              if (startTxResp.transactionId) {
                // schedule status notification for charging
                newEvents.push({
                  method: 'StatusNotification',
                  notBefore: new Date(Date.now() + 2 * 1000).toISOString(),
                  payload: {
                    connectorId: event.payload.connectorId,
                    errorCode: 'NoError',
                    status: 'Charging'
                  }
                })
                addTransaction({
                  transactionId: startTxResp.transactionId,
                  startTime: event.payload.timestamp,
                  ...event.payload
                })
                done()
              }
            } catch {
              logger.error({ event }, 'Error while sending: ' + event.method)
            }
            break

          case 'StopTransaction':
            try {
              const stopTxResp: cStopTransaction = await cli.call('StopTransaction', event.payload) as cStopTransaction
              // schedule status notification for finishing and available
              newEvents.push({
                method: 'StatusNotification',
                notBefore: new Date(Date.now() + 2 * 1000).toISOString(),
                payload: {
                  connectorId: event.payload.connectorId,
                  errorCode: 'NoError',
                  status: 'Finishing'
                }
              })
              newEvents.push({
                method: 'StatusNotification',
                notBefore: new Date(Date.now() + 17 * 1000).toISOString(),
                payload: {
                  connectorId: event.payload.connectorId,
                  errorCode: 'NoError',
                  status: 'Available'
                }
              })
              // endTransaction({
              //   transactionId: startTxResp.transactionId,
              //   startTime: event.payload.timestamp,
              //   ...event.payload
              // })
              done()
            } catch {
              logger.error({ event }, 'Error while sending: ' + event.method)
            }
            break
        }
      }
      logger.debug({ events_length: newEvents.length }, 'New events!')
      writeFileSync('./events.json', JSON.stringify(newEvents), { encoding: 'utf8' })
    } else {
      logger.debug('There is no events.json')
    }
  } catch (e) {
    logger.error('Error while checking events from disk!')
  }
}

function addTransaction(transaction: any) {
  try {
    if (existsSync('./transactions.json')) {
      const txJson = readFileSync('./transactions.json', { encoding: 'utf8' })
      if (txJson) {
        const transactions: any[] = JSON.parse(txJson)
        transactions.push(transaction)
        writeFileSync('./transactions.json', JSON.stringify(transactions), { encoding: 'utf8' })
      } else {
        writeFileSync('./transactions.json', JSON.stringify([transaction]), { encoding: 'utf8' })
      }
    } else {
      writeFileSync('./transactions.json', JSON.stringify([transaction]), { encoding: 'utf8' })
    }
  } catch {
    logger.error('Error while adding transaction to disk!')
  }
}

async function heartbeat(cli) {
  // send a Heartbeat request and await the response
  const heartbeatResponse: cHeartbeat = await cli.call('Heartbeat', {}) as cHeartbeat
  // read the current server time from the response
  logger.info({ currentTime: heartbeatResponse.currentTime }, 'Server time is:')
}

main()
