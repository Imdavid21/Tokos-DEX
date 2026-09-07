import type { TransactionRequest } from '@ethersproject/abstract-provider'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TokosOneDeltaBffClient, selectExecutionPlan } from '~/features/Swap/oneDelta'
import type { OneDeltaTransaction, TokosSwapQuote } from '~/features/Swap/oneDelta'
import { useAccount } from '~/hooks/useAccount'
import { useEthersWeb3Provider } from '~/hooks/useEthersProvider'
import { useSelectChain } from '~/hooks/useSelectChain'
import './TokosSwap.css'

const CHAIN_ID = 1
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const DEFAULT_SLIPPAGE_BPS = 50

interface TokenConfig {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
}

const TOKENS: TokenConfig[] = [
  { symbol: 'ETH', name: 'Ether', address: ZERO_ADDRESS, decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', name: 'Dai', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'wstETH', name: 'Wrapped stETH', address: '0x7f39C581F595B53c5cb5b296d4E9e8b3fE7a4f1E', decimals: 18 },
  { symbol: 'USDe', name: 'USDe', address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3', decimals: 18 },
  { symbol: 'sUSDe', name: 'Staked USDe', address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497', decimals: 18 },
]

const routingClient = new TokosOneDeltaBffClient()

function parseUnits(value: string, decimals: number): string | null {
  const normalized = value.trim()
  if (!/^\d*(\.\d*)?$/.test(normalized) || normalized === '' || normalized === '.') {
    return null
  }
  const [whole = '0', fraction = ''] = normalized.split('.')
  if (fraction.length > decimals) {
    return null
  }
  const base = `${whole || '0'}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '') || '0'
  try {
    return BigInt(base).toString()
  } catch {
    return null
  }
}

function formatUnits(raw: string, decimals: number, maxDecimals = 6): string {
  try {
    const value = BigInt(raw)
    const negative = value < 0n
    const absolute = negative ? -value : value
    const padded = absolute.toString().padStart(decimals + 1, '0')
    const whole = padded.slice(0, -decimals) || '0'
    const fraction = decimals === 0 ? '' : padded.slice(-decimals).replace(/0+$/, '').slice(0, maxDecimals)
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
  } catch {
    return '0'
  }
}

function formatQuoteAmount(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return '—'
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return String(value)
  }
  if (numeric === 0) {
    return '0'
  }
  if (numeric >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (numeric >= 1) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 6 })
  }
  return numeric.toLocaleString(undefined, { maximumSignificantDigits: 6 })
}

function shortenAddress(address?: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function tokenInitial(symbol: string): string {
  return symbol.slice(0, 2).toUpperCase()
}

function toTransactionRequest(tx: OneDeltaTransaction): TransactionRequest {
  return {
    to: tx.to,
    data: tx.data,
    value: tx.value ?? '0',
    chainId: CHAIN_ID,
  }
}

async function connectInjectedWallet(): Promise<void> {
  const ethereum = (window as unknown as { ethereum?: { request: (request: { method: string }) => Promise<unknown> } }).ethereum
  if (!ethereum) {
    throw new Error('No injected wallet found. Use the wallet button in the header to connect.')
  }
  await ethereum.request({ method: 'eth_requestAccounts' })
}

export function TokosSwap(): JSX.Element {
  const account = useAccount()
  const provider = useEthersWeb3Provider({ chainId: account.chainId ?? CHAIN_ID })
  const selectChain = useSelectChain()

  const [tokenIn, setTokenIn] = useState<TokenConfig>(TOKENS[0])
  const [tokenOut, setTokenOut] = useState<TokenConfig>(TOKENS[2])
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState<string>('—')
  const [quote, setQuote] = useState<TokosSwapQuote | null>(null)
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [executionState, setExecutionState] = useState<'idle' | 'building' | 'approving' | 'swapping' | 'success' | 'error'>('idle')
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS)

  const baseAmount = useMemo(() => parseUnits(amount, tokenIn.decimals), [amount, tokenIn.decimals])
  const isConnected = account.status === 'connected' && Boolean(account.address)
  const bestAmountOut = quote?.bestRoute?.amountOut
  const routeCount = quote?.routes.length ?? 0

  const refreshBalance = useCallback(async () => {
    if (!provider || !account.address) {
      setBalance('—')
      return
    }

    try {
      if (tokenIn.address === ZERO_ADDRESS) {
        const nativeBalance = await provider.getBalance(account.address)
        setBalance(formatUnits(nativeBalance.toString(), tokenIn.decimals, 5))
        return
      }

      const addressWord = account.address.toLowerCase().replace(/^0x/, '').padStart(64, '0')
      const result = await provider.call({ to: tokenIn.address, data: `0x70a08231${addressWord}` })
      setBalance(formatUnits(result, tokenIn.decimals, 5))
    } catch {
      setBalance('—')
    }
  }, [account.address, provider, tokenIn])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  useEffect(() => {
    if (!baseAmount || BigInt(baseAmount) <= 0n || tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
      setQuote(null)
      setQuoteState('idle')
      setQuoteError(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setQuoteState('loading')
      setQuoteError(null)
      try {
        const nextQuote = await routingClient.getSpotQuote({
          chainId: CHAIN_ID,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: baseAmount,
          slippage: slippageBps,
        })
        if (cancelled) return
        if (!nextQuote.bestRoute) {
          throw new Error('No route is available for this trade.')
        }
        setQuote(nextQuote)
        setQuoteState('ready')
      } catch (error) {
        if (cancelled) return
        setQuote(null)
        setQuoteState('error')
        setQuoteError(error instanceof Error ? error.message : 'Unable to fetch a quote')
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [baseAmount, slippageBps, tokenIn.address, tokenOut.address])

  const swapTokens = useCallback(() => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmount('')
    setQuote(null)
    setExecutionState('idle')
    setExecutionError(null)
    setTxHash(null)
  }, [tokenIn, tokenOut])

  const handleMax = useCallback(() => {
    if (balance === '—') return
    if (tokenIn.address === ZERO_ADDRESS) {
      const numeric = Number(balance)
      if (Number.isFinite(numeric)) {
        setAmount(String(Math.max(0, numeric - 0.005)))
      }
      return
    }
    setAmount(balance)
  }, [balance, tokenIn.address])

  const sendAndWait = useCallback(
    async (tx: OneDeltaTransaction): Promise<string> => {
      if (!provider) {
        throw new Error('Wallet provider is unavailable')
      }
      const response = await provider.getSigner().sendTransaction(toTransactionRequest(tx))
      await response.wait()
      return response.hash
    },
    [provider],
  )

  const executeSwap = useCallback(async () => {
    setExecutionError(null)
    setTxHash(null)

    if (!isConnected || !account.address) {
      try {
        await connectInjectedWallet()
      } catch (error) {
        setExecutionState('error')
        setExecutionError(error instanceof Error ? error.message : 'Connect a wallet to continue')
      }
      return
    }
    if (!baseAmount || !quote?.bestRoute) {
      return
    }

    try {
      if (account.chainId !== CHAIN_ID) {
        setExecutionState('building')
        const switched = await selectChain(CHAIN_ID, { throwOnUserRejection: true })
        if (!switched) {
          throw new Error('Switch to Ethereum to continue')
        }
      }

      setExecutionState('building')
      const execution = await routingClient.buildSpotSwap({
        chainId: CHAIN_ID,
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amount: baseAmount,
        slippage: slippageBps,
        account: account.address as `0x${string}`,
      })
      const plan = selectExecutionPlan(execution, 0)

      for (const permission of plan.permissions) {
        setExecutionState('approving')
        await sendAndWait(permission)
      }

      let finalHash = ''
      for (const transaction of plan.swapTransactions) {
        setExecutionState('swapping')
        finalHash = await sendAndWait(transaction)
      }

      setTxHash(finalHash || null)
      setExecutionState('success')
      setAmount('')
      setQuote(null)
      await refreshBalance()
    } catch (error) {
      setExecutionState('error')
      setExecutionError(error instanceof Error ? error.message : 'Swap failed')
    }
  }, [
    account.address,
    account.chainId,
    baseAmount,
    isConnected,
    quote?.bestRoute,
    refreshBalance,
    selectChain,
    sendAndWait,
    slippageBps,
    tokenIn.address,
    tokenOut.address,
  ])

  const actionLabel = useMemo(() => {
    if (!isConnected) return 'Connect wallet'
    if (!amount) return 'Enter an amount'
    if (!baseAmount) return 'Check amount'
    if (quoteState === 'loading') return 'Finding best route…'
    if (quoteState === 'error') return 'No route available'
    if (executionState === 'building') return 'Preparing swap…'
    if (executionState === 'approving') return `Approve ${tokenIn.symbol}…`
    if (executionState === 'swapping') return 'Swapping…'
    if (quoteState !== 'ready') return 'Review trade'
    return `Swap ${tokenIn.symbol}`
  }, [amount, baseAmount, executionState, isConnected, quoteState, tokenIn.symbol])

  const actionDisabled =
    isConnected &&
    (!baseAmount || quoteState !== 'ready' || executionState === 'building' || executionState === 'approving' || executionState === 'swapping')

  return (
    <main className="tokos-dex-shell">
      <section className="tokos-dex-intro">
        <div className="tokos-dex-wordmark"><img src="/tokos-icon.svg" alt="" />tokos<span>.fun</span></div>
        <div className="tokos-dex-network"><i /> Ethereum</div>
      </section>

      <section className="tokos-trade-layout">
        <div className="tokos-trade-copy">
          <p className="tokos-kicker">TOKOS DEX</p>
          <h1>Trade at the<br />best available <em>route.</em></h1>
          <p>Non-custodial execution across available liquidity, with one quote and one wallet flow.</p>
          <div className="tokos-trade-facts">
            <span>Best-route execution</span>
            <span>Your wallet</span>
            <span>0% platform fee in beta</span>
          </div>
        </div>

        <div className="tokos-swap-card" aria-label="Tokos swap">
          <div className="tokos-card-header">
            <div><strong>Swap</strong><span>Ethereum</span></div>
            <label className="tokos-slippage">Slippage
              <select value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value))}>
                <option value={10}>0.1%</option>
                <option value={50}>0.5%</option>
                <option value={100}>1.0%</option>
              </select>
            </label>
          </div>

          <div className="tokos-token-panel">
            <div className="tokos-panel-top"><span>You pay</span><span>Balance {balance}</span></div>
            <div className="tokos-token-row">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setExecutionState('idle')
                  setTxHash(null)
                }}
                placeholder="0"
                aria-label={`Amount of ${tokenIn.symbol} to sell`}
              />
              <div className="tokos-token-picker">
                <span className="tokos-token-icon">{tokenInitial(tokenIn.symbol)}</span>
                <select value={tokenIn.address} onChange={(event) => {
                  const selected = TOKENS.find((token) => token.address === event.target.value)
                  if (selected) setTokenIn(selected)
                }} aria-label="Sell token">
                  {TOKENS.map((token) => <option key={token.address} value={token.address}>{token.symbol}</option>)}
                </select>
              </div>
            </div>
            <button className="tokos-max" onClick={handleMax} type="button">MAX</button>
          </div>

          <button className="tokos-flip" onClick={swapTokens} type="button" aria-label="Switch tokens">↓</button>

          <div className="tokos-token-panel tokos-output-panel">
            <div className="tokos-panel-top"><span>You receive</span><span>{routeCount > 1 ? `${routeCount} routes checked` : 'Best route'}</span></div>
            <div className="tokos-token-row">
              <div className={`tokos-output ${quoteState === 'loading' ? 'loading' : ''}`}>
                {quoteState === 'loading' ? 'Finding…' : formatQuoteAmount(bestAmountOut)}
              </div>
              <div className="tokos-token-picker">
                <span className="tokos-token-icon accent">{tokenInitial(tokenOut.symbol)}</span>
                <select value={tokenOut.address} onChange={(event) => {
                  const selected = TOKENS.find((token) => token.address === event.target.value)
                  if (selected) setTokenOut(selected)
                }} aria-label="Buy token">
                  {TOKENS.map((token) => <option key={token.address} value={token.address}>{token.symbol}</option>)}
                </select>
              </div>
            </div>
          </div>

          {quoteState === 'ready' && quote?.bestRoute && (
            <div className="tokos-route-details">
              <div><span>Route</span><strong>Best available</strong></div>
              <div><span>Slippage tolerance</span><strong>{(slippageBps / 100).toFixed(1)}%</strong></div>
              <div><span>Platform fee</span><strong>0%</strong></div>
            </div>
          )}

          {quoteError && <div className="tokos-message error">{quoteError}</div>}
          {executionError && <div className="tokos-message error">{executionError}</div>}
          {executionState === 'success' && (
            <div className="tokos-message success">
              Swap confirmed{txHash ? <> · <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction ↗</a></> : null}
            </div>
          )}

          <button className="tokos-swap-action" type="button" disabled={Boolean(actionDisabled)} onClick={() => void executeSwap()}>
            {actionLabel}<span>↗</span>
          </button>

          <div className="tokos-wallet-line">
            <span>{isConnected ? shortenAddress(account.address) : 'Wallet not connected'}</span>
            <span>Non-custodial</span>
          </div>
        </div>
      </section>

      <section className="tokos-route-strip" aria-label="Execution principles">
        <span>01 / Quote</span><b>→</b><span>02 / Approve</span><b>→</b><span>03 / Sign</span><b>→</b><span>04 / Settle onchain</span>
      </section>
    </main>
  )
}
