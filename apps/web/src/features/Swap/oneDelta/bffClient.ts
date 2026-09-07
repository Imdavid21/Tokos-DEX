import type {
  OneDeltaQuoteRoute,
  OneDeltaSpotSwapRequest,
  OneDeltaSpotSwapResponse,
  TokosQuoteRoute,
  TokosSwapExecution,
  TokosSwapQuote,
} from './types'

function assertSuccessfulEnvelope(body: OneDeltaSpotSwapResponse): void {
  if (body.success) {
    return
  }

  const code = body.error?.code ? `${body.error.code}: ` : ''
  throw new Error(`${code}${body.error?.message ?? 'Routing service returned an unsuccessful response'}`)
}

function normalizeRoute(route: OneDeltaQuoteRoute): TokosQuoteRoute {
  return {
    source: 'tokos-routing',
    amountIn: route.tradeInput ?? route.deltas?.tradeInput,
    amountOut: route.tradeOutput ?? route.deltas?.tradeOutput,
    raw: route,
  }
}

async function request(path: string, params: URLSearchParams): Promise<OneDeltaSpotSwapResponse> {
  const response = await fetch(`${path}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => null)) as OneDeltaSpotSwapResponse | null

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Tokos swap API failed with HTTP ${response.status}`)
  }
  if (!body) {
    throw new Error('Tokos swap API returned invalid JSON')
  }

  assertSuccessfulEnvelope(body)
  return body
}

function toParams(input: OneDeltaSpotSwapRequest): URLSearchParams {
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

  return params
}

export class TokosOneDeltaBffClient {
  async getSpotQuote(input: Omit<OneDeltaSpotSwapRequest, 'account'>): Promise<TokosSwapQuote> {
    const raw = await request('/api/tokos/quote', toParams(input))
    const routes = (raw.data?.quotes ?? []).map(normalizeRoute)
    return { provider: 'tokos', routes, bestRoute: routes[0], raw }
  }

  async buildSpotSwap(input: OneDeltaSpotSwapRequest & { account: `0x${string}` }): Promise<TokosSwapExecution> {
    const raw = await request('/api/tokos/swap/build', toParams(input))
    if (!raw.actions) {
      throw new Error('Routing service returned no execution actions')
    }

    return {
      provider: 'tokos',
      permissions: raw.actions.permissions ?? [],
      transactions: raw.actions.transactions ?? [],
      alternatives: raw.actions.alternatives ?? [],
      raw,
    }
  }
}
