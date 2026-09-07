import type { Context } from 'hono'

const DEFAULT_ONEDELTA_API_URL = 'https://portal.1delta.io'
const SPOT_SWAP_PATH = '/v1/actions/swap/spot'
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const INTEGER_PATTERN = /^\d+$/

type OneDeltaBindings = {
  ONEDELTA_API_KEY?: string
  ONEDELTA_API_URL?: string
}

type SwapMode = 'quote' | 'build'

function badRequest(message: string): Response {
  return Response.json({ success: false, error: { code: 'INVALID_REQUEST', message } }, { status: 400 })
}

function getValidatedParams(c: Context, mode: SwapMode): URLSearchParams | Response {
  const chainId = c.req.query('chainId')
  const tokenIn = c.req.query('tokenIn')
  const tokenOut = c.req.query('tokenOut')
  const amount = c.req.query('amount')
  const slippage = c.req.query('slippage')
  const account = c.req.query('account')

  if (!chainId || !INTEGER_PATTERN.test(chainId) || Number(chainId) <= 0) {
    return badRequest('chainId must be a positive integer')
  }
  if (!tokenIn || !ADDRESS_PATTERN.test(tokenIn) || !tokenOut || !ADDRESS_PATTERN.test(tokenOut)) {
    return badRequest('tokenIn and tokenOut must be valid EVM addresses')
  }
  if (!amount || !INTEGER_PATTERN.test(amount) || BigInt(amount) <= 0n) {
    return badRequest('amount must be a positive integer in token base units')
  }
  if (slippage !== undefined) {
    if (!INTEGER_PATTERN.test(slippage)) {
      return badRequest('slippage must be an integer in basis points')
    }
    const slippageBps = Number(slippage)
    if (slippageBps < 0 || slippageBps > 10_000) {
      return badRequest('slippage must be between 0 and 10000 basis points')
    }
  }
  if (mode === 'build' && (!account || !ADDRESS_PATTERN.test(account))) {
    return badRequest('account is required and must be a valid EVM address')
  }

  const params = new URLSearchParams({ chainId, tokenIn, tokenOut, amount })
  if (slippage !== undefined) {
    params.set('slippage', slippage)
  }
  if (mode === 'build' && account) {
    params.set('account', account)
  }

  return params
}

async function proxySpotSwap(c: Context, mode: SwapMode): Promise<Response> {
  const paramsOrError = getValidatedParams(c, mode)
  if (paramsOrError instanceof Response) {
    return paramsOrError
  }

  const env = c.env as OneDeltaBindings
  const apiUrl = (env.ONEDELTA_API_URL || DEFAULT_ONEDELTA_API_URL).replace(/\/$/, '')
  const headers = new Headers({ Accept: 'application/json' })
  if (env.ONEDELTA_API_KEY) {
    headers.set('x-api-key', env.ONEDELTA_API_KEY)
  }

  try {
    const upstream = await fetch(`${apiUrl}${SPOT_SWAP_PATH}?${paramsOrError.toString()}`, {
      method: 'GET',
      headers,
      redirect: 'manual',
    })

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
    responseHeaders.set('Cache-Control', 'no-store')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return Response.json(
      { success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: '1delta is temporarily unavailable' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}

export function oneDeltaQuoteHandler(c: Context): Promise<Response> {
  return proxySpotSwap(c, 'quote')
}

export function oneDeltaBuildHandler(c: Context): Promise<Response> {
  return proxySpotSwap(c, 'build')
}
