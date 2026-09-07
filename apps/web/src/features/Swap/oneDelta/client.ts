import type {
  OneDeltaSpotSwapRequest,
  OneDeltaSpotSwapResponse,
  TokosSwapExecution,
  TokosSwapQuote,
} from './types'

const DEFAULT_ONEDELTA_API_URL = 'https://portal.1delta.io'
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
  if (!input.amount || !/^\d+$/.test(input.amount) || BigInt(input.amount) <= 0n) {
    throw new Error('Amount must be a positive integer in token base units')
  }
  if (input.slippage !== undefined && (!Number.isInteger(input.slippage) || input.slippage < 0 || input.slippage > 10_000)) {
    throw new Error('Slippage must be an integer between 0 and 10000 basis points')
  }
}

function assertSuccessfulEnvelope(body: OneDeltaSpotSwapResponse): void {
  if (body.success) {
    return
  }

  const code = body.error?.code ? `${body.error.code}: ` : ''
  throw new Error(`${code}${body.error?.message ?? '1delta returned an unsuccessful response'}`)
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

    if (!actions) {
      throw new Error('1delta returned no execution actions')
    }

    return {
      provider: '1delta',
      permissions: actions.permissions ?? [],
      transactions: actions.transactions ?? [],
      alternatives: actions.alternatives ?? [],
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
    const body = (await response.json().catch(() => null)) as OneDeltaSpotSwapResponse | null

    if (!response.ok) {
      const message = body?.error?.message ?? `HTTP ${response.status}`
      throw new Error(`1delta request failed: ${message}`)
    }
    if (!body) {
      throw new Error('1delta returned an invalid JSON response')
    }

    assertSuccessfulEnvelope(body)
    return body
  }
}
