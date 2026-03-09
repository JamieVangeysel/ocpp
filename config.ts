import type { LoggerOptions } from 'pino'

export interface IConfig {
  port: number
  rpcConfig: {
    protocols: string[]
    strictMode?: boolean
  },
  logging: LoggerOptions
}
