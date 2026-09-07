import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public')
const PORT = Number(process.env.PORT || 3000)
const ROUTING_API_BASE_URL = (process.env.ROUTING_API_BASE_URL || '').replace(/\/$/, '')
const ROUTING_API_KEY = process.env.ROUTING_API_KEY || ''
const DIRECT_MARKET_API_KEY = process.env.UNISWAP_API_KEY || ''
const FEE_BPS = Number(process.env.TOKOS_FEE_BPS || 0)
const FEE_RECIPIENT = process.env.TOKOS_FEE_RECIPIENT || ''
const SPOT_SWAP_PATH = ROUTING_API_BASE_URL.endsWith('/v1') ? '/actions/swap/spot' : '/v1/actions/swap/spot'
const DIRECT_QUOTE_URL = 'https://trade-api.gateway.uniswap.org/v1/quote'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const INTEGER = /^\d+$/
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
}

const buckets = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const windowMs = 60_000
  const max = 90
  const current = buckets.get(ip)
  if (!current || now - current.started > windowMs) {
    buckets.set(ip, { started: now, count: 1 })
    return false
  }
  current.count += 1
  return current.count > max
}

function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    ...extra,
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  }))
  res.end(payload)
}

function getParams(url, mode) {
  const chainId = url.searchParams.get('chainId')
  const tokenIn = url.searchParams.get('tokenIn')
  const tokenOut = url.searchParams.get('tokenOut')
  const amount = url.searchParams.get('amount')
  const slippage = url.searchParams.get('slippage') || '50'
  const account = url.searchParams.get('account')

  if (!chainId || !INTEGER.test(chainId) || Number(chainId) <= 0) return { error: 'Invalid chain' }
  if (!tokenIn || !ADDRESS.test(tokenIn) || !tokenOut || !ADDRESS.test(tokenOut)) return { error: 'Invalid token address' }
  if (!amount || !INTEGER.test(amount) || BigInt(amount) <= 0n) return { error: 'Invalid amount' }
  if (!INTEGER.test(slippage) || Number(slippage) < 0 || Number(slippage) > 10_000) return { error: 'Invalid slippage' }
  if (mode === 'build' && (!account || !ADDRESS.test(account))) return { error: 'Connect a valid wallet' }

  const params = new URLSearchParams({ chainId, tokenIn, tokenOut, amount, slippage, tradeType: '0' })
  if (mode === 'build') params.set('account', account)
  return { params, account, chainId, tokenIn, tokenOut, amount, slippage }
}

async function proxyRouting(res, url, mode) {
  if (!ROUTING_API_BASE_URL) {
    return json(res, 503, { success: false, error: { message: 'Routing service is not configured' } })
  }
  const parsed = getParams(url, mode)
  if (parsed.error) return json(res, 400, { success: false, error: { message: parsed.error } })
  try {
    const headers = { Accept: 'application/json' }
    if (ROUTING_API_KEY) headers['x-api-key'] = ROUTING_API_KEY
    const upstream = await fetch(`${ROUTING_API_BASE_URL}${SPOT_SWAP_PATH}?${parsed.params}`, {
      method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(12_000),
    })
    const text = await upstream.text()
    let body
    try { body = JSON.parse(text) } catch { body = null }
    if (!upstream.ok || !body) {
      return json(res, upstream.status >= 400 ? upstream.status : 502, {
        success: false,
        error: { message: body?.error?.message || 'Routing service is unavailable' },
      })
    }
    return json(res, 200, body)
  } catch {
    return json(res, 502, { success: false, error: { message: 'Routing service is temporarily unavailable' } })
  }
}

async function directBenchmark(res, url) {
  if (!DIRECT_MARKET_API_KEY) {
    return json(res, 503, { success: false, error: { code: 'NOT_CONFIGURED', message: 'Direct benchmark is not configured' } })
  }
  const parsed = getParams(url, 'build')
  if (parsed.error) return json(res, 400, { success: false, error: { message: parsed.error } })
  try {
    const upstream = await fetch(DIRECT_QUOTE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': DIRECT_MARKET_API_KEY,
        'x-universal-router-version': '2.0',
        'x-erc20eth-enabled': 'true',
      },
      body: JSON.stringify({
        type: 'EXACT_INPUT',
        amount: parsed.amount,
        tokenInChainId: Number(parsed.chainId),
        tokenOutChainId: Number(parsed.chainId),
        tokenIn: parsed.tokenIn,
        tokenOut: parsed.tokenOut,
        swapper: parsed.account,
        slippageTolerance: Number(parsed.slippage) / 100,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await upstream.json().catch(() => null)
    if (!upstream.ok || !body) {
      return json(res, 502, { success: false, error: { message: 'Direct benchmark is unavailable' } })
    }
    return json(res, 200, {
      success: true,
      data: {
        amountOut: body?.quote?.output?.amount,
        gasEstimateUsd: body?.quote?.classicGasUseEstimateUSD,
        routing: body?.routing,
      },
    })
  } catch {
    return json(res, 502, { success: false, error: { message: 'Direct benchmark is unavailable' } })
  }
}

async function serveFile(req, res, pathname) {
  const requestPath = pathname === '/' ? '/index.html' : pathname
  const safePath = normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '')
  let filePath = join(ROOT, safePath)
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, 'index.html')
    const data = await readFile(filePath)
    res.writeHead(200, securityHeaders({
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      'Content-Length': data.length,
    }))
    res.end(data)
  } catch {
    try {
      const data = await readFile(join(ROOT, 'index.html'))
      res.writeHead(200, securityHeaders({ 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }))
      res.end(data)
    } catch {
      res.writeHead(404, securityHeaders())
      res.end('Not found')
    }
  }
}

const server = createServer(async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (rateLimited(ip)) return json(res, 429, { success: false, error: { message: 'Too many requests' } })
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'tokos-dex',
      routingConfigured: Boolean(ROUTING_API_BASE_URL),
      directBenchmarkConfigured: Boolean(DIRECT_MARKET_API_KEY),
      feeBps: Number.isFinite(FEE_BPS) ? FEE_BPS : 0,
      feeRecipientConfigured: Boolean(FEE_RECIPIENT),
    })
  }
  if (url.pathname === '/api/quote' && req.method === 'GET') return proxyRouting(res, url, 'quote')
  if (url.pathname === '/api/build' && req.method === 'GET') return proxyRouting(res, url, 'build')
  if (url.pathname === '/api/benchmark' && req.method === 'GET') return directBenchmark(res, url)
  if (url.pathname.startsWith('/api/')) return json(res, 404, { success: false, error: { message: 'Not found' } })
  return serveFile(req, res, url.pathname)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tokos DEX listening on :${PORT}`)
})