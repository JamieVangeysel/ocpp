import { IncomingMessage, ServerResponse, createServer, Server } from 'http'
import { WebSocket, WebSocketServer, OPEN, CLOSING, CLOSED, ServerOptions } from 'ws'
import { EventEmitter, once } from 'events'
import { IHandshakeInterface, OCPP_ServerClient } from './server-client'
import { WebsocketUpgradeError } from './errors'
import { getServerName } from './util'
import { abortHandshake, parseSubprotocols } from './ws-util'
import { Socket } from 'net'

interface OCPP_ServerOptions {
  wssOptions?: ServerOptions
  protocols?: string[] // server accepts ocpp1.6/ocpp2.0 subprotocol
  callTimeoutMs?: number
  pingIntervalMs?: number
  deferPingsOnActivity?: boolean
  respondWithDetailedErrors?: boolean
  callConcurrency?: number
  maxBadMessages?: number
  strictMode?: boolean | string[] // enable/disable strict validation of requests & responses, if string array is present only enable strict for select protocols
  // strictModeValidators?: Validator[]
}

export default class OCPP_Server extends EventEmitter {
  _wss: WebSocketServer
  _options: OCPP_ServerOptions
  _httpServerAbortControllers: Set<any>
  _clients: Set<OCPP_ServerClient>
  _state: typeof OPEN |
    typeof CLOSING |
    typeof CLOSED
  _pendingUpgrades: WeakMap<any, any>

  authCallback: any

  constructor(options: OCPP_ServerOptions, _callback?: () => void) {
    super()

    this._httpServerAbortControllers = new Set()
    this._state = OPEN
    this._clients = new Set()
    this._pendingUpgrades = new WeakMap()

    // configure default options
    this._options = {
      wssOptions: {},
      protocols: [],
      callTimeoutMs: 1000 * 30,
      pingIntervalMs: 1000 * 30,
      deferPingsOnActivity: false,
      respondWithDetailedErrors: false,
      callConcurrency: 1,
      maxBadMessages: Infinity,
      strictMode: false,
      // strictModeValidators: [],
      ...options
    }

    // create WebSocketServer instance without http server
    this._wss = new WebSocketServer({
      ...this._options.wssOptions,
      noServer: true,
      handleProtocols: (protocols, request) => {
        const { protocol } = this._pendingUpgrades.get(request)
        return protocol
      },
    })

    // return server header as: npm package name/version platform
    this._wss.on('headers', h => h.push(`Server: ${getServerName()}`))
    this._wss.on('error', err => this.emit('error', err))
    this._wss.on('connection', this._onConnection.bind(this))
  }

  get handleUpgrade() {
    return async (request: IncomingMessage, socket: Socket, head: Buffer) => {
      let resolved = false

      const ac = new AbortController()
      const { signal } = ac

      const url = new URL('http://localhost' + (request.url || '/'))
      const pathParts: string[] = url.pathname.split('/')
      const identity = decodeURIComponent(pathParts.pop() ?? '')

      const abortUpgrade = (error) => {
        resolved = true
        // console.error('abortUpgrade', error)

        if (error && error instanceof WebsocketUpgradeError)
          abortHandshake(socket, error.code, error.message)
        else
          abortHandshake(socket, 500)

        if (!signal.aborted) {
          ac.abort(error)
          this.emit('upgradeAborted', {
            error,
            socket,
            request,
            identity,
          })
        }
      }

      socket.on('error', abortUpgrade)

      try {
        if (socket.readyState !== 'open')
          throw new WebsocketUpgradeError(400, `Client readyState = '${socket.readyState}'`)

        const headers = request.headers

        if (headers.upgrade?.toLowerCase() !== 'websocket')
          throw new WebsocketUpgradeError(400, 'Can only upgrade websocket upgrade requests')

        const endpoint = pathParts.join('/') || '/'
        const remoteAddress = request.socket.remoteAddress
        const protocols = ('sec-websocket-protocol' in request.headers)
          ? parseSubprotocols(request.headers['sec-websocket-protocol'])
          : new Set()

        let password
        if (headers.authorization) {
          try {
            /**
             * This is a non-standard basic auth parser because it supports
             * colons in usernames (which is normally disallowed in the RFC).
             * However, this shouldn't cause any confusion as we have a
             * guarantee from OCPP that the username will always be equal to
             * the identity.
             * It also supports binary passwords, which is also a spec violation
             * but is necessary for allowing truly random binary keys as
             * recommended by the OCPP security whitepaper.
             */
            const regExpMatch = headers.authorization.match(/^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/)
            if (regExpMatch) {
              const b64up = regExpMatch[1]
              const userPassBuffer = Buffer.from(b64up, 'base64')

              const clientIdentityUserBuffer = Buffer.from(identity + ':')

              if (clientIdentityUserBuffer.compare(userPassBuffer, 0, clientIdentityUserBuffer.length) === 0)
                // first part of buffer matches `${identity}:` as required by spec
                password = userPassBuffer.subarray(clientIdentityUserBuffer.length)
            }
          } catch (err) {
            // failing to parse authorization header is no big deal.
            // just leave password as undefined as if no header was sent.
            // if authentication is required the auth handler will handle this
          }
        }

        const handshake = {
          remoteAddress,
          headers,
          protocols,
          endpoint,
          identity,
          query: url.searchParams,
          request,
          password,
        }

        const accept = (session?: Record<string, any>, protocol?: string | false) => {
          if (resolved) return
          resolved = true

          try {
            if (socket.readyState !== 'open')
              throw new WebsocketUpgradeError(400, `Client readyState = '${socket.readyState}'`)

            if (protocol === undefined)
              // pick first subprotocol (preferred by server) that is also supported by the client
              protocol = (this._options.protocols ?? []).find(p => protocols.has(p))
            else if (protocol !== false && !protocols.has(protocol))
              throw new WebsocketUpgradeError(400, `Client doesn't support expected subprotocol`)

            // cache auth results for connection creation
            this._pendingUpgrades.set(request, {
              session: session ?? {},
              protocol,
              handshake
            })

            this._wss.handleUpgrade(request, socket, head, ws => { this._wss.emit('connection', ws, request) })
          } catch (err) {
            abortUpgrade(err)
          }
        }

        const reject = (code = 404, message = 'Not found') => {
          if (resolved) return
          resolved = true
          abortUpgrade(new WebsocketUpgradeError(code, message))
        }

        socket.once('end', () => {
          reject(400, `Client connection closed before upgrade complete`)
        })

        socket.once('close', () => {
          reject(400, `Client connection closed before upgrade complete`)
        })

        // if auth is used wait for callback to complete
        if (this.authCallback) {
          await this.authCallback(
            accept,
            reject,
            handshake,
            signal
          )
        } else
          accept()

      } catch (err) {
        abortUpgrade(err)
      }
    }
  }

  async _onConnection(websocket: WebSocket, request) {
    try {
      if (this._state !== OPEN)
        throw Error('Server is no longer open')

      const { handshake, session } = this._pendingUpgrades.get(request)

      const client = new OCPP_ServerClient({
        identity: handshake.identity,
        reconnect: false,
        callTimeoutMs: this._options.callTimeoutMs ?? 1000 * 30,
        pingIntervalMs: this._options.pingIntervalMs ?? 1000 * 30,
        deferPingsOnActivity: this._options.deferPingsOnActivity ?? false,
        respondWithDetailedErrors: this._options.respondWithDetailedErrors ?? false,
        callConcurrency: this._options.callConcurrency ?? 1,
        strictMode: this._options.strictMode ?? false,
        // strictModeValidators: this._options.strictModeValidators,
        maxReconnects: -1,
        maxBadMessages: this._options.maxBadMessages ?? Infinity,
        protocols: this._options.protocols ?? [],
      }, {
        ws: websocket,
        session,
        handshake,
      })

      this._clients.add(client)
      client.once('close', () => this._clients.delete(client))
      this.emit('client', client)
    } catch (err) {
      websocket.close(err.statusCode || 1000, err.message)
    }
  }

  auth(cb: (accept: (session?: Record<string, any>, protocol?: string | false) => void, reject: (code: number, message: string) => void, handshake: IHandshakeInterface, signal?: AbortSignal) => void): void {
    this.authCallback = cb
  }

  async listen(port: number = 80, host: string = '::', options: Record<string, any> = {}): Promise<Server<typeof IncomingMessage, typeof ServerResponse>> {
    const ac = new AbortController()
    this._httpServerAbortControllers.add(ac)
    if (options.signal)
      once(options.signal, 'abort').then(() => {
        ac.abort(options.signal.reason)
      })

    const server = createServer({ noDelay: true }, (req, res) => {
      res.setHeader('Server', getServerName())
      res.statusCode = 404
      res.end()
    })
    server.on('upgrade', this.handleUpgrade)
    server.once('close', () => this._httpServerAbortControllers.delete(ac))
    await new Promise((resolve, reject) => {
      server.listen({
        port,
        host,
        signal: ac.signal,
      }, () => {
        // console.log('Server listening on port %s', port)
        resolve(undefined)
      }).on('error', (err) =>
        reject(err)
      )
    })
    return server
  }

  async close({ code, reason, awaitPending, force }: Record<string, any> = {}): Promise<void> {
    if (this._state === OPEN) {
      this._state = CLOSING
      this.emit('closing')
      code = code ?? 1001
      await Array.from(this._clients)
        .map(cli => cli.close({ code, reason, awaitPending, force }))
      await new Promise((resolve, reject) => {
        this._wss.close(err => err ? reject(err) : resolve(undefined))
        this._httpServerAbortControllers.forEach(ac => ac.abort('Closing'))
      })
      this._state = CLOSED
      this.emit('close')
    }
  }

  // retrieve a specific client based on identity
  getClient(identity: string) {
    return Array.from(this._clients).find(e => e.identity === identity)
  }
}
