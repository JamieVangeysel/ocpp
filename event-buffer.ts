import EventEmitter from 'events'

export class EventBuffer {
  private _emitter: EventEmitter
  private _event: string | symbol
  private _collector
  private _buffer

  constructor(emitter: EventEmitter, event: string | symbol) {
    this._emitter = emitter
    this._event = event
    this._collector = (...args) => this._buffer.push(args)
    this._buffer = []
    this._emitter.on(event, this._collector)
  }

  condense(): any {
    this._emitter.off(this._event, this._collector)
    return this._buffer
  }
}