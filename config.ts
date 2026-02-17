export interface IConfig {
  port: number
  rpcConfig: {
    protocols: string[]
    strictMode?: boolean
  }
}
