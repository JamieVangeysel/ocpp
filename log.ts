import { appendFileSync } from 'fs'
import { InitialClient } from './repository'

export function log(client: InitialClient | string, message: string) {
  appendFileSync('./message.log', formatLogMessaage(typeof client === 'string' ? client : client.hostname, message) + '\n')
}

export function formatLogMessaage(client: string, message: string) {
  return `[${new Date().toISOString()}] ${client} - ${message}`
}