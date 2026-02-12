import crypto from 'crypto'
import { Logger } from 'pino'

export class Repository {
  dbName: string
  private _logger: Logger

  constructor(logger: Logger) {
    this._logger = logger
    this.dbName = 'sapphire'
  }
  static uuidv4() {
    return crypto.randomUUID()
  }

  static toIsoString(date: Date): string {
    var tzo = -date.getTimezoneOffset(),
      dif = tzo >= 0 ? '+' : '-',
      pad = function (num) {
        return (num < 10 ? '0' : '') + num
      }

    return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) + '.000Z'
    // dif + pad(Math.floor(Math.abs(tzo) / 60)) +
    // ':' + pad(Math.abs(tzo) % 60)
  }
}

export interface InitialClient {
  hostname: string
}
