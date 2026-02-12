import { IncomingHttpHeaders, IncomingMessage } from 'http'
import OCPP_Client, { OCPP_ClientOptions } from './client'
import { OPEN, WebSocket } from 'ws'

export interface IHandshakeInterface {
  remoteAddress: string | undefined
  headers: IncomingHttpHeaders
  protocols: Set<string>
  endpoint: string
  identity: string
  query: URLSearchParams
  request: IncomingMessage
  password: Buffer | undefined
}

export class OCPP_ServerClient extends OCPP_Client {
  private _session: Record<string, any>
  private _handshake: IHandshakeInterface

  last_update: number = 0

  constructor(options: OCPP_ClientOptions, { ws, handshake, session }: {
    ws: WebSocket
    session: Record<string, any>
    handshake: IHandshakeInterface
  }) {
    super(options)

    this._session = session
    this._handshake = handshake

    this._state = OPEN
    this._identity = this._options.identity
    this._ws = ws
    this._protocol = ws.protocol
    this._attachWebsocket(this._ws)
  }

  get handshake(): IHandshakeInterface {
    return this._handshake
  }

  get session(): Record<string, any> {
    return this._session
  }

  async connect(): Promise<void> {
    throw Error('Cannot connect from server to client')
  }
}