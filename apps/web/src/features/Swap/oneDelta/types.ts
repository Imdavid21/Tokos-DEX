export type HexAddress = `0x${string}`
export type HexData = `0x${string}`

export interface OneDeltaSpotSwapRequest {
  chainId: number
  tokenIn: HexAddress
  tokenOut: HexAddress
  amount: string
  /** Slippage in basis points as accepted by 1delta, e.g. 50 = 0.5%. */
  slippage?: number
  /** Omit for quote-only requests. Include to build executable actions. */
  account?: HexAddress
}

export interface OneDeltaTransaction {
  to: HexAddress
  data: HexData
  value?: string
  description?: string
  [key: string]: unknown
}

export interface OneDeltaActions {
  permissions?: OneDeltaTransaction[] | null
  transactions?: OneDeltaTransaction[] | null
  alternatives?: OneDeltaTransaction[] | null
  [key: string]: unknown
}

export interface OneDeltaApiError {
  code?: string
  message?: string
  [key: string]: unknown
}

export interface OneDeltaSpotSwapResponse {
  success: boolean
  data?: Record<string, unknown> | null
  actions?: OneDeltaActions | null
  error?: OneDeltaApiError
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
  alternatives: OneDeltaTransaction[]
  raw: OneDeltaSpotSwapResponse
}
