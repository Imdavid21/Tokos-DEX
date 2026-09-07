export type HexAddress = `0x${string}`
export type HexData = `0x${string}`

export interface OneDeltaSpotSwapRequest {
  chainId: number
  tokenIn: HexAddress
  tokenOut: HexAddress
  amount: string
  /** Slippage in basis points, e.g. 50 = 0.5%. */
  slippage?: number
  /** Omit for quote-only requests. Include to build executable actions. */
  account?: HexAddress
}

export interface OneDeltaTransaction {
  to: HexAddress
  data: HexData
  value?: string
  description?: string
  spender?: HexAddress
  [key: string]: unknown
}

export interface OneDeltaQuoteRoute {
  aggregator?: string
  tradeInput?: number | string
  tradeOutput?: number | string
  deltas?: {
    aggregator?: string
    tradeInput?: number | string
    tradeOutput?: number | string
    [key: string]: unknown
  }
  tx?: OneDeltaTransaction
  [key: string]: unknown
}

export interface OneDeltaSpotSwapData {
  quotes?: OneDeltaQuoteRoute[]
  currencyIn?: Record<string, unknown>
  currencyOut?: Record<string, unknown>
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
  data?: OneDeltaSpotSwapData | null
  actions?: OneDeltaActions | null
  error?: OneDeltaApiError
  [key: string]: unknown
}

export interface TokosQuoteRoute {
  source: 'tokos-routing'
  amountIn?: number | string
  amountOut?: number | string
  raw: OneDeltaQuoteRoute
}

export interface TokosSwapQuote {
  provider: 'tokos'
  routes: TokosQuoteRoute[]
  bestRoute?: TokosQuoteRoute
  raw: OneDeltaSpotSwapResponse
}

export interface TokosSwapExecution {
  provider: 'tokos'
  permissions: OneDeltaTransaction[]
  transactions: OneDeltaTransaction[]
  alternatives: OneDeltaTransaction[]
  raw: OneDeltaSpotSwapResponse
}
