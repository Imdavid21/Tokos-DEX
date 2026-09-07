export type HexAddress = `0x${string}`
export type HexData = `0x${string}`

export interface OneDeltaSpotSwapRequest {
  chainId: number
  tokenIn: HexAddress
  tokenOut: HexAddress
  amount: string
  /** Slippage percentage as accepted by 1delta, e.g. 0.5 = 0.5%. */
  slippage?: number
  /** Omit for quote-only requests. Include to build executable actions. */
  account?: HexAddress
}

export interface OneDeltaTransaction {
  to: HexAddress
  data: HexData
  value?: string
  [key: string]: unknown
}

export interface OneDeltaActions {
  permissions?: OneDeltaTransaction[]
  transactions?: OneDeltaTransaction[]
  alternatives?: OneDeltaTransaction[] | OneDeltaTransaction[][]
  [key: string]: unknown
}

export interface OneDeltaSpotSwapResponse {
  actions?: OneDeltaActions
  [key: string]: unknown
}

export interface TokosSwapQuote {
  provider: '1delta'
  raw: OneDeltaSpotSwapResponse
}

export interface TokosSwapExecution {
  provider: '1delta'
  permissions: OneDeltaTransaction[]
  transactions: OneDeltaTransaction[]
  alternatives: OneDeltaTransaction[][]
  raw: OneDeltaSpotSwapResponse
}
