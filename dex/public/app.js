const CHAIN_ID = 1
const CHAIN_HEX = '0x1'
const ZERO = '0x0000000000000000000000000000000000000000'
const TOKENS = [
  { symbol: 'ETH', name: 'Ether', address: ZERO, decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', name: 'Dai', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'wstETH', name: 'Wrapped stETH', address: '0x7f39C581F595B53c5cb5b296d4E9e8b3fE7a4f1E', decimals: 18 },
  { symbol: 'USDe', name: 'USDe', address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3', decimals: 18 },
  { symbol: 'sUSDe', name: 'Staked USDe', address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497', decimals: 18 },
]

const $ = (id) => document.getElementById(id)
const ui = {
  walletTop: $('wallet-top'), walletStatus: $('wallet-status'), tokenIn: $('token-in'), tokenOut: $('token-out'),
  tokenInBadge: $('token-in-badge'), tokenOutBadge: $('token-out-badge'), amountIn: $('amount-in'), amountOut: $('amount-out'),
  balance: $('balance'), max: $('max-button'), flip: $('flip'), slippage: $('slippage'), slippageReadout: $('slippage-readout'),
  routeCount: $('route-count'), details: $('quote-details'), benchmarkRow: $('benchmark-row'), benchmarkOutput: $('benchmark-output'),
  message: $('message'), action: $('action'),
}

let account = null
let chainId = null
let quote = null
let quoteTimer = null
let quoting = false
let executing = false
let currentBalance = null
let requestSequence = 0

function tokenByAddress(address) {
  return TOKENS.find((t) => t.address.toLowerCase() === String(address).toLowerCase())
}
function inputToken() { return tokenByAddress(ui.tokenIn.value) || TOKENS[0] }
function outputToken() { return tokenByAddress(ui.tokenOut.value) || TOKENS[2] }
function badge(symbol) { return symbol.slice(0, 2).toUpperCase() }
function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '' }

function parseUnits(value, decimals) {
  const text = String(value).trim()
  if (!/^\d*(\.\d*)?$/.test(text) || !text || text === '.') return null
  const [whole = '0', fraction = ''] = text.split('.')
  if (fraction.length > decimals) return null
  const raw = `${whole || '0'}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '') || '0'
  try { return BigInt(raw).toString() } catch { return null }
}
function formatUnits(raw, decimals, maxDecimals = 6) {
  try {
    const value = BigInt(raw)
    const negative = value < 0n
    const absolute = negative ? -value : value
    if (decimals === 0) return `${negative ? '-' : ''}${absolute}`
    const padded = absolute.toString().padStart(decimals + 1, '0')
    const whole = padded.slice(0, -decimals) || '0'
    const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, maxDecimals)
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
  } catch { return '0' }
}
function pretty(value) {
  if (value === undefined || value === null || value === '') return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  if (number >= 1000) return number.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (number >= 1) return number.toLocaleString(undefined, { maximumFractionDigits: 6 })
  return number.toLocaleString(undefined, { maximumSignificantDigits: 6 })
}
function toHexQuantity(value) {
  if (value === undefined || value === null || value === '' || value === '0') return '0x0'
  const text = String(value)
  if (text.startsWith('0x')) return text
  try { return `0x${BigInt(text).toString(16)}` } catch { return '0x0' }
}
function showMessage(text, type = 'info', html = false) {
  ui.message.className = `message ${type}`
  if (html) ui.message.innerHTML = text
  else ui.message.textContent = text
}
function clearMessage() { ui.message.className = 'message hidden'; ui.message.textContent = '' }
function setBusyOutput(busy) {
  ui.amountOut.classList.toggle('loading', busy)
  if (busy) ui.amountOut.textContent = 'Finding…'
}

function populateTokens() {
  const markup = TOKENS.map((t) => `<option value="${t.address}">${t.symbol}</option>`).join('')
  ui.tokenIn.innerHTML = markup
  ui.tokenOut.innerHTML = markup
  ui.tokenIn.value = TOKENS[0].address
  ui.tokenOut.value = TOKENS[2].address
  refreshBadges()
}
function refreshBadges() {
  ui.tokenInBadge.textContent = badge(inputToken().symbol)
  ui.tokenOutBadge.textContent = badge(outputToken().symbol)
}

async function ethereumRequest(method, params = []) {
  if (!window.ethereum?.request) throw new Error('No compatible browser wallet was found')
  return window.ethereum.request({ method, params })
}
async function connectWallet() {
  try {
    const accounts = await ethereumRequest('eth_requestAccounts')
    account = accounts?.[0] || null
    chainId = await ethereumRequest('eth_chainId')
    updateWalletUI()
    await refreshBalance()
    scheduleQuote()
  } catch (error) {
    showMessage(error?.message || 'Wallet connection was cancelled', 'error')
  }
}
function updateWalletUI() {
  const connected = Boolean(account)
  ui.walletTop.textContent = connected ? shortAddress(account) : 'Connect wallet'
  ui.walletStatus.textContent = connected ? `${shortAddress(account)} · ${chainId === CHAIN_HEX ? 'Ethereum' : 'Wrong network'}` : 'Wallet not connected'
  updateAction()
}
async function switchEthereum() {
  if (chainId === CHAIN_HEX) return
  try {
    await ethereumRequest('wallet_switchEthereumChain', [{ chainId: CHAIN_HEX }])
    chainId = CHAIN_HEX
    updateWalletUI()
  } catch (error) {
    throw new Error(error?.code === 4001 ? 'Network switch was cancelled' : 'Switch your wallet to Ethereum')
  }
}

async function refreshBalance() {
  currentBalance = null
  ui.balance.textContent = '—'
  if (!account || !window.ethereum) return
  try {
    const token = inputToken()
    let raw
    if (token.address === ZERO) {
      raw = await ethereumRequest('eth_getBalance', [account, 'latest'])
    } else {
      const addressWord = account.toLowerCase().replace(/^0x/, '').padStart(64, '0')
      raw = await ethereumRequest('eth_call', [{ to: token.address, data: `0x70a08231${addressWord}` }, 'latest'])
    }
    currentBalance = BigInt(raw)
    ui.balance.textContent = formatUnits(currentBalance, token.decimals, 5)
  } catch {
    ui.balance.textContent = '—'
  }
}

function quoteOutput(route) {
  return route?.tradeOutput ?? route?.deltas?.tradeOutput ?? route?.amountOut
}
function quoteInput(route) {
  return route?.tradeInput ?? route?.deltas?.tradeInput ?? route?.amountIn
}
function bestQuote(body) {
  const routes = body?.data?.quotes || []
  if (!routes.length) return null
  return { route: routes[0], routes }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) throw new Error(body?.error?.message || 'Request failed')
  return body
}

function buildParams(includeAccount = false) {
  const tokenIn = inputToken()
  const tokenOut = outputToken()
  const raw = parseUnits(ui.amountIn.value, tokenIn.decimals)
  if (!raw || BigInt(raw) <= 0n) return null
  const params = new URLSearchParams({
    chainId: String(CHAIN_ID), tokenIn: tokenIn.address, tokenOut: tokenOut.address,
    amount: raw, slippage: ui.slippage.value,
  })
  if (includeAccount && account) params.set('account', account)
  return { params, raw, tokenIn, tokenOut }
}

async function fetchQuote() {
  const built = buildParams(false)
  if (!built || inputToken().address.toLowerCase() === outputToken().address.toLowerCase()) {
    quote = null; ui.amountOut.textContent = '—'; ui.details.classList.add('hidden'); ui.routeCount.textContent = 'Best route'; updateAction(); return
  }
  const sequence = ++requestSequence
  quoting = true; setBusyOutput(true); clearMessage(); updateAction()
  try {
    const body = await fetchJson(`/api/quote?${built.params}`)
    if (sequence !== requestSequence) return
    const parsed = bestQuote(body)
    if (!parsed) throw new Error('No executable route is available for this trade')
    quote = { ...parsed, raw: body, input: built }
    ui.amountOut.textContent = pretty(quoteOutput(parsed.route))
    ui.amountOut.classList.remove('loading')
    ui.routeCount.textContent = parsed.routes.length > 1 ? `${parsed.routes.length} routes checked` : 'Best route'
    ui.details.classList.remove('hidden')
    ui.slippageReadout.textContent = `${Number(ui.slippage.value) / 100}%`
    await fetchBenchmark(built, sequence)
  } catch (error) {
    if (sequence !== requestSequence) return
    quote = null; ui.amountOut.textContent = '—'; ui.details.classList.add('hidden')
    showMessage(error?.message || 'Unable to find a route', 'error')
  } finally {
    if (sequence === requestSequence) { quoting = false; ui.amountOut.classList.remove('loading'); updateAction() }
  }
}

async function fetchBenchmark(built, sequence) {
  ui.benchmarkRow.classList.add('hidden')
  if (!account) return
  const params = new URLSearchParams(built.params)
  params.set('account', account)
  try {
    const response = await fetch(`/api/benchmark?${params}`, { cache: 'no-store' })
    if (response.status === 503) return
    const body = await response.json().catch(() => null)
    if (sequence !== requestSequence || !response.ok || !body?.success || !body?.data?.amountOut) return
    ui.benchmarkOutput.textContent = `${formatUnits(body.data.amountOut, built.tokenOut.decimals, 6)} ${built.tokenOut.symbol}`
    ui.benchmarkRow.classList.remove('hidden')
  } catch { /* Optional benchmark never blocks a Tokos quote. */ }
}
function scheduleQuote() {
  clearTimeout(quoteTimer)
  quote = null
  ui.details.classList.add('hidden')
  ui.benchmarkRow.classList.add('hidden')
  quoteTimer = setTimeout(fetchQuote, 420)
  updateAction()
}

function actionText() {
  if (!account) return 'Connect wallet'
  if (chainId !== CHAIN_HEX) return 'Switch to Ethereum'
  if (!ui.amountIn.value) return 'Enter an amount'
  if (quoting) return 'Finding best route…'
  if (executing) return 'Confirm in wallet…'
  if (!quote) return 'Review trade'
  return `Swap ${inputToken().symbol}`
}
function updateAction() {
  ui.action.querySelector('span').textContent = actionText()
  ui.action.disabled = Boolean(account && (quoting || executing || (ui.amountIn.value && !quote && chainId === CHAIN_HEX)))
}

function normalizeActions(body) {
  const actions = body?.actions
  if (!actions) throw new Error('No executable transaction was returned')
  const permissions = Array.isArray(actions.permissions) ? actions.permissions : []
  const setup = Array.isArray(actions.transactions) ? actions.transactions : []
  const alternatives = Array.isArray(actions.alternatives) ? actions.alternatives : []
  const selected = alternatives[0]
  const swaps = selected ? [...setup, selected] : setup
  if (!swaps.length) throw new Error('No executable swap transaction was returned')
  return { permissions, swaps }
}
async function waitReceipt(hash, label) {
  showMessage(`${label} submitted. Waiting for confirmation…`, 'info')
  const started = Date.now()
  while (Date.now() - started < 180_000) {
    const receipt = await ethereumRequest('eth_getTransactionReceipt', [hash])
    if (receipt) {
      if (receipt.status === '0x0') throw new Error(`${label} reverted onchain`)
      return receipt
    }
    await new Promise((resolve) => setTimeout(resolve, 1800))
  }
  throw new Error(`${label} is still pending. Check your wallet or block explorer.`)
}
async function sendTransaction(tx, label) {
  if (!tx?.to || !tx?.data) throw new Error(`Invalid ${label.toLowerCase()} transaction`)
  const request = { from: account, to: tx.to, data: tx.data, value: toHexQuantity(tx.value) }
  const hash = await ethereumRequest('eth_sendTransaction', [request])
  await waitReceipt(hash, label)
  return hash
}

async function execute() {
  clearMessage()
  if (!account) return connectWallet()
  if (chainId !== CHAIN_HEX) {
    try { await switchEthereum(); await refreshBalance(); scheduleQuote() } catch (error) { showMessage(error.message, 'error') }
    return
  }
  if (!quote) return scheduleQuote()
  const built = buildParams(true)
  if (!built) return
  if (currentBalance !== null && BigInt(built.raw) > currentBalance) {
    return showMessage(`Insufficient ${built.tokenIn.symbol} balance`, 'error')
  }

  executing = true; updateAction()
  try {
    showMessage('Preparing transaction…', 'info')
    const body = await fetchJson(`/api/build?${built.params}`)
    const plan = normalizeActions(body)
    for (let i = 0; i < plan.permissions.length; i += 1) {
      showMessage(`Approval ${i + 1} of ${plan.permissions.length}. Confirm in your wallet.`, 'info')
      await sendTransaction(plan.permissions[i], 'Approval')
    }
    let finalHash
    for (let i = 0; i < plan.swaps.length; i += 1) {
      showMessage(`Transaction ${i + 1} of ${plan.swaps.length}. Confirm in your wallet.`, 'info')
      finalHash = await sendTransaction(plan.swaps[i], 'Swap')
    }
    showMessage(`Swap confirmed · <a href="https://etherscan.io/tx/${finalHash}" target="_blank" rel="noreferrer">View transaction ↗</a>`, 'success', true)
    ui.amountIn.value = ''
    quote = null; ui.amountOut.textContent = '—'; ui.details.classList.add('hidden')
    await refreshBalance()
  } catch (error) {
    const message = error?.code === 4001 ? 'Transaction was cancelled in your wallet' : (error?.message || 'Swap failed')
    showMessage(message, 'error')
  } finally { executing = false; updateAction() }
}

function flip() {
  const a = ui.tokenIn.value
  ui.tokenIn.value = ui.tokenOut.value
  ui.tokenOut.value = a
  ui.amountIn.value = ''
  quote = null; ui.amountOut.textContent = '—'; ui.details.classList.add('hidden')
  refreshBadges(); refreshBalance(); updateAction()
}
function maxAmount() {
  if (currentBalance === null) return
  const token = inputToken()
  if (token.address === ZERO) {
    const reserve = 5_000_000_000_000_000n
    const usable = currentBalance > reserve ? currentBalance - reserve : 0n
    ui.amountIn.value = formatUnits(usable, token.decimals, token.decimals)
  } else {
    ui.amountIn.value = formatUnits(currentBalance, token.decimals, token.decimals)
  }
  scheduleQuote()
}

function bind() {
  populateTokens()
  ui.walletTop.addEventListener('click', connectWallet)
  ui.action.addEventListener('click', execute)
  ui.amountIn.addEventListener('input', scheduleQuote)
  ui.tokenIn.addEventListener('change', () => { refreshBadges(); refreshBalance(); scheduleQuote() })
  ui.tokenOut.addEventListener('change', () => { refreshBadges(); scheduleQuote() })
  ui.slippage.addEventListener('change', () => { ui.slippageReadout.textContent = `${Number(ui.slippage.value) / 100}%`; scheduleQuote() })
  ui.flip.addEventListener('click', flip)
  ui.max.addEventListener('click', maxAmount)

  if (window.ethereum?.on) {
    window.ethereum.on('accountsChanged', async (accounts) => { account = accounts?.[0] || null; updateWalletUI(); await refreshBalance(); scheduleQuote() })
    window.ethereum.on('chainChanged', async (next) => { chainId = next; updateWalletUI(); await refreshBalance(); scheduleQuote() })
  }
  ;(async () => {
    if (!window.ethereum) { updateWalletUI(); return }
    try {
      const accounts = await ethereumRequest('eth_accounts')
      account = accounts?.[0] || null
      chainId = await ethereumRequest('eth_chainId')
      updateWalletUI()
      await refreshBalance()
    } catch { updateWalletUI() }
  })()
}

bind()
