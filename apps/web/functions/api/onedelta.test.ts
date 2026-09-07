import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { oneDeltaBuildHandler, oneDeltaQuoteHandler } from './onedelta'

function app() {
  const testApp = new Hono()
  testApp.get('/api/tokos/quote', oneDeltaQuoteHandler)
  testApp.get('/api/tokos/swap/build', oneDeltaBuildHandler)
  return testApp
}

const base =
  'chainId=1&tokenIn=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2&tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amount=1000000000000000000&slippage=50'

describe('Tokos 1delta BFF validation', () => {
  it('rejects an invalid token address before contacting the upstream', async () => {
    const response = await app().request(`/api/tokos/quote?${base.replace('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0x123')}`)
    expect(response.status).toBe(400)
  })

  it('requires an account for execution builds', async () => {
    const response = await app().request(`/api/tokos/swap/build?${base}`)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.message).toContain('account is required')
  })

  it('rejects non-integer slippage', async () => {
    const response = await app().request(`/api/tokos/quote?${base.replace('slippage=50', 'slippage=0.5')}`)
    expect(response.status).toBe(400)
  })
})
