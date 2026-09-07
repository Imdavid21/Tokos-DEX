import {
  DEV_ENTRY_GATEWAY_API_BASE_URL,
  PROD_ENTRY_GATEWAY_API_BASE_URL,
  STAGING_ENTRY_GATEWAY_API_BASE_URL,
} from '@universe/api'
import { Environment } from '@universe/config'
import { auctionImageHandler } from 'functions/api/image/auctions'
import { poolImageHandler } from 'functions/api/image/pools'
import { positionImageHandler } from 'functions/api/image/positions'
import { tokenImageHandler } from 'functions/api/image/tokens'
import { oneDeltaBuildHandler, oneDeltaQuoteHandler } from 'functions/api/onedelta'
import { uniswapQuoteHandler } from 'functions/api/uniswapQuote'
import { metaTagInjectionMiddleware } from 'functions/components/metaTagInjector'
import { rewriteProxiedCookies } from 'functions/cookie-utils'
import { resolveFramePolicy } from 'functions/frameProtection'
import { Context, Hono } from 'hono'
import { proxy } from 'hono/proxy'

type Bindings = {
  ASSETS?: { fetch: typeof fetch }
  ONEDELTA_API_KEY?: string
  ONEDELTA_API_URL?: string
  ONEDELTA_API_BASE_URL?: string
  UNISWAP_API_KEY?: string
}

const ENTRY_GATEWAY_ENV_BY_SEGMENT: Record<string, Environment> = {
  dev: Environment.Development,
  staging: Environment.Staging,
  prod: Environment.Production,
}

interface AppConfig {
  fetchSpaHtml: (c: Context) => Promise<Response>
  getEntryGatewayUrl: (c: Context, env?: Environment) => string
  getWebSocketUrl: (c: Context) => string
  getTrustedClientIp: (c: Context) => string | undefined
  getEmbedFrameAncestors: (c: Context) => string | undefined
}

export const ENTRY_GATEWAY_URLS = {
  development: DEV_ENTRY_GATEWAY_API_BASE_URL,
  staging: STAGING_ENTRY_GATEWAY_API_BASE_URL,
  production: PROD_ENTRY_GATEWAY_API_BASE_URL,
} as const

const STATSIG_PROXY_TARGET = 'https://gating.interface.gateway.uniswap.org'

export const WEBSOCKET_URLS = {
  development: 'https://websockets.backend-staging.api.uniswap.org',
  staging: 'https://websockets.backend-staging.api.uniswap.org',
  production: 'https://websockets.backend-prod.api.uniswap.org',
} as const

function cacheControl(maxAge: number) {
  return async (c: Context, next: () => Promise<void>) => {
    await next()
    if (c.res.ok) {
      c.res.headers.set('Cache-Control', `public, max-age=${maxAge}`)
    }
  }
}

function resolveEnvFromPath(path: string): { env: Environment | undefined; remainingPath: string } {
  const match = path.match(/^\/(prod|staging|dev)(?=\/|$)(.*)$/)
  if (!match) {
    return { env: undefined, remainingPath: path }
  }
  return { env: ENTRY_GATEWAY_ENV_BY_SEGMENT[match[1]], remainingPath: match[2] || '/' }
}

export function createApp({
  fetchSpaHtml,
  getEntryGatewayUrl,
  getWebSocketUrl,
  getTrustedClientIp,
  getEmbedFrameAncestors,
}: AppConfig) {
  const app = new Hono<{ Bindings: Bindings }>()

  app.get('/api/image/tokens/:networkName/:tokenAddress', cacheControl(604800), tokenImageHandler)
  app.get('/api/image/pools/:networkName/:poolAddress', cacheControl(604800), poolImageHandler)
  app.get('/api/image/auctions/:chainName/:auctionAddress', cacheControl(604800), auctionImageHandler)
  app.get('/api/image/positions/:version/:chainName/:identifier', cacheControl(604800), positionImageHandler)

  // Tokos execution and quote-comparison BFF routes.
  app.get('/api/tokos/quote', oneDeltaQuoteHandler)
  app.get('/api/tokos/swap/build', oneDeltaBuildHandler)
  app.get('/api/tokos/quote/uniswap', uniswapQuoteHandler)

  app.all('/entry-gateway/*', async (c) => {
    const initialPath = c.req.path.slice('/entry-gateway'.length) || '/'
    const { env, remainingPath } = resolveEnvFromPath(initialPath)
    const backendUrl = getEntryGatewayUrl(c, env)
    const query = new URL(c.req.url).search
    const clientIp = getTrustedClientIp(c)
    const targetUrl = `${backendUrl}${remainingPath}${query}`
    const response = await proxy(targetUrl, {
      ...c.req,
      headers: {
        ...c.req.header(),
        host: undefined,
        ...(clientIp ? { 'cf-connecting-ip': clientIp } : {}),
      },
      redirect: 'manual',
    })
    return rewriteProxiedCookies(response)
  })

  app.all('/config/*', async (c) => {
    const path = c.req.path.replace(/^\/config/, '/v1/statsig-proxy')
    const query = new URL(c.req.url).search
    return proxy(`${STATSIG_PROXY_TARGET}${path}${query}`, {
      ...c.req,
      headers: {
        ...c.req.header(),
        host: undefined,
      },
      redirect: 'manual',
    })
  })

  app.get('/ws', async (c) => {
    const wsUrl = getWebSocketUrl(c)
    const headers = new Headers(c.req.raw.headers)
    headers.delete('host')
    headers.delete('origin')
    try {
      return await fetch(wsUrl, { headers })
    } catch (err) {
      return c.text(`WebSocket proxy error: ${err}`, 502)
    }
  })

  app.all('*', async (c: Context) => {
    const url = new URL(c.req.url)
    const applyFramePolicy = resolveFramePolicy(url.pathname, () => getEmbedFrameAncestors(c))
    const next = async () => {
      const response = await fetchSpaHtml(c)
      c.res = response
    }

    if (url.pathname.startsWith('/api/')) {
      await next()
      return applyFramePolicy(c.res)
    }

    return applyFramePolicy(await metaTagInjectionMiddleware(c, next))
  })

  return app
}
