import type { Context } from 'hono'

const UNISWAP_QUOTE_URL = 'https://trade-api.gateway.uniswap.org/v1/quote'
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const INTEGER_PATTERN = /^\d+$/

type Bindings = {
  UNISWAP_API_KEY?: string
}

function badRequest(message: string): Response {
  return Response.json({ success: false, error: { code: 'INVALID_REQUEST', message } }, { status: 400 })
}

export async function uniswapQuoteHandler(c: Context): Promise<Response> {
  const env = c.env as Bindings
  if (!env.UNISWAP_API_KEY) {
    return Response.json(
      { success: false, error: { code: 'SOURCE_NOT_CONFIGURED', message: 'Direct market benchmark is not configured' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const chainId = c.req.query('chainId')
  const tokenIn = c.req.query('tokenIn')
  const tokenOut = c.req.query('tokenOut')
  const amount = c.req.query('amount')
  const account = c.req.query('account')
  const slippageBps = c.req.query('slippage') ?? '50'

  if (!chainId || !INTEGER_PATTERN.test(chainId) || Number(chainId) <= 0) return badRequest('Invalid chainId')
  if (!tokenIn || !ADDRESS_PATTERN.test(tokenIn) || !tokenOut || !ADDRESS_PATTERN.test(tokenOut)) return badRequest('Invalid token address')
  if (!amount || !INTEGER_PATTERN.test(amount) || BigInt(amount) <= 0n) return badRequest('Invalid amount')
  if (!account || !ADDRESS_PATTERN.test(account)) return badRequest('A connected wallet is required for this benchmark')
  if (!INTEGER_PATTERN.test(slippageBps) || Number(slippageBps) > 10_000) return badRequest('Invalid slippage')

  try {
    const upstream = await fetch(UNISWAP_QUOTE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': env.UNISWAP_API_KEY,
        'x-universal-router-version': '2.0',
        'x-erc20eth-enabled': 'true',
      },
      body: JSON.stringify({
        type: 'EXACT_INPUT',
        amount,
        tokenInChainId: Number(chainId),
        tokenOutChainId: Number(chainId),
        tokenIn,
        tokenOut,
        swapper: account,
        slippageTolerance: Number(slippageBps) / 100,
      }),
    })

    const body = (await upstream.json().catch(() => null)) as Record<string, unknown> | null
    if (!upstream.ok || !body) {
      return Response.json(
        { success: false, error: { code: 'BENCHMARK_UNAVAILABLE', message: 'Direct market benchmark is unavailable' } },
        { status: upstream.status || 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const quote = body.quote as { output?: { amount?: string }; classicGasUseEstimateUSD?: string } | undefined
    return Response.json(
      {
        success: true,
        data: {
          amountOut: quote?.output?.amount,
          gasEstimateUsd: quote?.classicGasUseEstimateUSD,
          routing: body.routing,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json(
      { success: false, error: { code: 'BENCHMARK_UNAVAILABLE', message: 'Direct market benchmark is unavailable' } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
