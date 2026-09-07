import type {
  OneDeltaSpotSwapRequest,
  OneDeltaSpotSwapResponse,
  OneDeltaTransaction,
  TokosSwapExecution,
  TokosSwapQuote,
} from './types'

const DEFAULT_ONEDELTA_API_URL = 'https://api.1delta.io'
const SPOT_SWAP_PATH = '/v1/actions/swap/spot'

export interface OneDeltaClientOptions {
  apiUrl?: string
  apiKey?: string
  fetcher?: typeof fetch
}

function assertRequest(input: OneDeltaSpotSwapRequest): void {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
    throw new Error('Invalid chainId')
  }
  if (!input.tokenIn?.startsWith('0x') || !input.tokenOut?.startsWith('0x')) {
    throw new Error('Invalid token address')
  }
  if (!input.amount || Number(input.amount) <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (input.slippage !== undefined && (input.slippage < 0 || input.slippage > 100)) {
    throw new Error('Slippage must be between 0 and 100 percent')
  }
}

function normalizeAlternatives(actions: OneDeltaSpotSwapResponse['actions']): OneDeltaTransaction[][] {
  const alternatives = actions?.alternatives
  if (!Array.isArray(alternatives)) {
    return []
  }

  return alternatives.map((alternative) => (Array.isArray(alternative) ? alternative : [alternative]))
}

export class OneDeltaClient {
  private readonly apiUrl: string
  private readonly apiKey?: string
  private readonly fetcher: typeof fetch

  constructor(options: OneDeltaClientOptions = {}) {
    this.apiUrl = (options.apiUrl ?? DEFAULT_ONEDELTA_API_URL).replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? fetch
  }

  async getSpotQuote(input: Omit<OneDeltaSpotSwapRequest, 'account'>): Promise<TokosSwapQuote> {
    const raw = await this.request(input)
    return { provider: '1delta', raw }
  }

  async buildSpotSwap(input: OneDeltaSpotSwapRequest & { account: `0x${string}` }): Promise<TokosSwapExecution> {
    const raw = await this.request(input)
    const actions = raw.actions

    return {
      provider: '1delta',
      permissions: actions?.permissions ?? [],
      transactions: actions?.transactions ?? [],
      alternatives: normalizeAlternatives(actions),
      raw,
    }
  }

  private async request(input: OneDeltaSpotSwapRequest): Promise<OneDeltaSpotSwapResponse> {
    assertRequest(input)

    const params = new URLSearchParams({
      chainId: String(input.chainId),
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amount: input.amount,
    })

    if (input.slippage !== undefined) {
      params.set('slippage', String(input.slippage))
    }
    if (input.account) {
      params.set('account', input.account)
    }

    const headers = new Headers({ Accept: 'application/json' })
    if (this.apiKey) {
      headers.set('x-api-key', this.apiKey)
    }

    const response = await this.fetcher(`${this.apiUrl}${SPOT_SWAP_PATH}?${params.toString()}`, { headers })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`1delta request failed (${response.status})${details ? `: ${details}` : ''}`)
    }

    return (await response.json()) as OneDeltaSpotSwapResponse
  }
}
