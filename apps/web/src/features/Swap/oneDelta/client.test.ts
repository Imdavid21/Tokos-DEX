import { describe, expect, it, vi } from 'vitest'
import { OneDeltaClient } from './client'

const input = {
  chainId: 1,
  tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as const,
  tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
  amount: '1000000000000000000',
  slippage: 50,
}

describe('OneDeltaClient', () => {
  it('omits account for quote-only requests', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).not.toContain('account=')
      return Response.json({ success: true, data: { quotes: [] }, actions: null })
    }) as unknown as typeof fetch

    const client = new OneDeltaClient({ fetcher })
    await client.getSpotQuote(input)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('throws when 1delta returns success false even with HTTP 200', async () => {
    const fetcher = vi.fn(async () => Response.json({ success: false, error: { code: 'INVALID_PARAM', message: 'bad pair' } })) as unknown as typeof fetch
    const client = new OneDeltaClient({ fetcher })

    await expect(client.getSpotQuote(input)).rejects.toThrow('INVALID_PARAM: bad pair')
  })

  it('adds the API key only as an upstream header', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('x-api-key')).toBe('server-secret')
      return Response.json({ success: true, data: { quotes: [] }, actions: null })
    }) as unknown as typeof fetch

    const client = new OneDeltaClient({ apiKey: 'server-secret', fetcher })
    await client.getSpotQuote(input)
  })
})
