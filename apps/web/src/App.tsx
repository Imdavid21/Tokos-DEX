import { EXTENSION_PASSKEY_AUTH_PATH } from '@universe/embedded-wallet'
import { useEffect, useLayoutEffect } from 'react'
import { Helmet } from 'react-helmet-async/lib/index'
import { Navigate, useLocation } from 'react-router'
import { useSporeColors } from 'ui/src'
import { initializeScrollWatcher } from 'uniswap/src/components/modals/ScrollLock'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { ResetPageScrollEffect } from '~/app/bootstrap/ResetPageScroll'
import { ResetPortfolioChainOnEntryEffect } from '~/app/bootstrap/ResetPortfolioChainOnEntry'
import { UserPropertyUpdater } from '~/app/bootstrap/UserPropertyUpdater'
import { Body } from '~/app/layout/Body'
import { AppLayout } from '~/app/layout/Layout'
import { ErrorBoundary } from '~/components/ErrorBoundary'
import { useFeatureFlagUrlOverrides } from '~/featureFlags/useFeatureFlagUrlOverrides'
import { useDynamicMetatags } from '~/pages/metatags'
import { findRouteByPath } from '~/pages/RouteDefinitions'
import { useEmbedSession } from '~/pages/Swap/embedContext'
import { getSwapCapabilities } from '~/pages/Swap/swapCapabilities'
import { isPathBlocked } from '~/utils/blockedPaths'
import { MICROSITE_LINK } from '~/utils/openDownloadApp'
import { getCurrentPageFromLocation } from '~/utils/urlRoutes'

const OVERRIDE_PAGE_LAYOUT = [EXTENSION_PASSKEY_AUTH_PATH]

function toTokosCopy(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replaceAll('Uniswap', 'Tokos').replaceAll('UNISWAP', 'TOKOS')
}

export function App() {
  const colors = useSporeColors()

  const location = useLocation()
  const { pathname } = location
  const currentPage = getCurrentPageFromLocation(pathname)

  const { embedded, view: embedView } = useEmbedSession()

  useFeatureFlagUrlOverrides()

  useEffect(() => {
    initializeScrollWatcher()
  }, [])

  const metaTags = useDynamicMetatags()
  const routeDefinition = findRouteByPath(pathname)
  const staticTitle = toTokosCopy(routeDefinition?.getTitle(pathname), 'Tokos DEX')
  const staticDescription = toTokosCopy(
    routeDefinition?.getDescription(pathname),
    'Trade crypto with Tokos. Fast, non-custodial execution across the best available routes.',
  )

  const shouldRedirectToAppInstall = pathname.startsWith('/address/')
  useLayoutEffect(() => {
    if (shouldRedirectToAppInstall) {
      window.location.href = MICROSITE_LINK
    }
  }, [shouldRedirectToAppInstall])

  if (shouldRedirectToAppInstall) {
    return null
  }

  const shouldBlockPath = isPathBlocked(pathname)
  if (shouldBlockPath && pathname !== '/swap') {
    return <Navigate to="/swap" replace />
  }

  const shouldOverridePageLayout = OVERRIDE_PAGE_LAYOUT.includes(pathname)
  const embedCapabilities = getSwapCapabilities(embedView)

  return (
    <ErrorBoundary>
      <Trace page={currentPage}>
        <Helmet>
          <title>{staticTitle}</title>
          <meta name="description" content={staticDescription} />
          <meta property="og:description" content={staticDescription} />
          {metaTags.map((tag, index) => (
            <meta key={index} {...tag} />
          ))}
          <style>{`
            html {
              ::-webkit-scrollbar-thumb {
                background-color: ${colors.surface3.val};
              }
              scrollbar-color: ${colors.surface3.val} ${colors.surface1.val};
            }
          `}</style>
        </Helmet>
        <UserPropertyUpdater />
        <ResetPageScrollEffect />
        <ResetPortfolioChainOnEntryEffect />
        {embedded ? (
          embedCapabilities.appChrome ? (
            <AppLayout embedded embedView={embedView} />
          ) : (
            <Body shouldRenderAppChrome={false} embedded embedView={embedView} />
          )
        ) : shouldOverridePageLayout ? (
          <Body shouldRenderAppChrome={false} />
        ) : (
          <AppLayout />
        )}
      </Trace>
    </ErrorBoundary>
  )
}
