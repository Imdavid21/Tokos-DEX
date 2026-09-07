(() => {
  const nativeFetch = window.fetch.bind(window)
  const $ = id => document.getElementById(id)
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const short = v => typeof v === 'string' && v.length > 24 ? `${v.slice(0,10)}…${v.slice(-8)}` : String(v ?? '—')
  const scalar = v => v == null || ['string','number','boolean','bigint'].includes(typeof v)
  const source = q => q?.aggregator ?? q?.deltas?.aggregator ?? q?.source ?? q?.provider ?? q?.name ?? 'Route'
  const output = q => q?.tradeOutput ?? q?.deltas?.tradeOutput ?? q?.amountOut ?? q?.output ?? '—'
  const input = q => q?.tradeInput ?? q?.deltas?.tradeInput ?? q?.amountIn ?? q?.input ?? '—'

  function rows(obj, omit = []) {
    if (!obj || typeof obj !== 'object') return ''
    return Object.entries(obj)
      .filter(([k,v]) => !omit.includes(k) && scalar(v))
      .map(([k,v]) => `<div class="api-row"><span>${esc(k)}</span><strong title="${esc(String(v ?? ''))}">${esc(short(v))}</strong></div>`)
      .join('')
  }
  function nested(obj, omit = []) {
    if (!obj || typeof obj !== 'object') return ''
    return Object.entries(obj)
      .filter(([k,v]) => !omit.includes(k) && v && typeof v === 'object')
      .map(([k,v]) => `<details class="api-nested"><summary>${esc(k)}</summary><pre>${esc(JSON.stringify(v,null,2))}</pre></details>`)
      .join('')
  }
  function renderQuotes(body) {
    const panel = $('api-breakdown'), list = $('api-quote-list'), summary = $('api-summary'), raw = $('api-raw')
    if (!panel || !list) return
    const quotes = body?.data?.quotes || []
    panel.classList.remove('empty')
    summary.innerHTML = `
      <div><span>Quotes returned</span><strong>${quotes.length}</strong></div>
      <div><span>Best source</span><strong>${esc(source(quotes[0]))}</strong></div>
      <div><span>Status</span><strong>${body?.success === false ? 'Failed' : 'Ready'}</strong></div>`
    list.innerHTML = quotes.map((q,i) => `<article class="quote-candidate ${i===0?'winner':''}">
      <header><div><b>#${i+1}</b><strong>${esc(source(q))}</strong></div>${i===0?'<span>Selected</span>':''}</header>
      <div class="quote-primary"><div><span>Input</span><strong>${esc(short(input(q)))}</strong></div><div><span>Output</span><strong>${esc(short(output(q)))}</strong></div></div>
      <div class="api-grid">${rows(q,['deltas','tx','transaction','route','path','tokens'])}${rows(q?.deltas)}</div>
      ${nested(q,['deltas'])}
    </article>`).join('') || '<div class="api-empty">No quote candidates returned.</div>'
    if (raw) raw.textContent = JSON.stringify(body,null,2)
  }
  function renderBuild(body) {
    const execution = $('api-execution'), rawBuild = $('api-build-raw')
    if (!execution) return
    const a = body?.actions || body?.data?.actions || {}
    const permissions = Array.isArray(a.permissions) ? a.permissions : []
    const transactions = Array.isArray(a.transactions) ? a.transactions : []
    const alternatives = Array.isArray(a.alternatives) ? a.alternatives : []
    execution.classList.remove('hidden')
    execution.innerHTML = `<div class="execution-head"><strong>Execution plan</strong><span>${permissions.length} approvals · ${transactions.length} transactions · ${alternatives.length} alternatives</span></div>
      <div class="execution-grid">
        <div><span>Permissions</span><strong>${permissions.length}</strong></div>
        <div><span>Transactions</span><strong>${transactions.length}</strong></div>
        <div><span>Alternatives</span><strong>${alternatives.length}</strong></div>
      </div>
      ${permissions.map((x,i)=>`<details class="api-nested"><summary>Approval ${i+1}</summary><pre>${esc(JSON.stringify(x,null,2))}</pre></details>`).join('')}
      ${transactions.map((x,i)=>`<details class="api-nested"><summary>Transaction ${i+1}</summary><pre>${esc(JSON.stringify(x,null,2))}</pre></details>`).join('')}
      ${alternatives.map((x,i)=>`<details class="api-nested"><summary>Alternative ${i+1}</summary><pre>${esc(JSON.stringify(x,null,2))}</pre></details>`).join('')}`
    if (rawBuild) rawBuild.textContent = JSON.stringify(body,null,2)
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args)
    try {
      const url = String(args[0]?.url || args[0] || '')
      const body = await response.clone().json()
      if (/\/api\/quote\?/.test(url)) renderQuotes(body)
      if (/\/api\/build\?/.test(url)) renderBuild(body)
      if (/\/api\/benchmark\?/.test(url) && body?.success) {
        const el = $('api-benchmark')
        if (el) { el.classList.remove('hidden'); el.querySelector('pre').textContent = JSON.stringify(body,null,2) }
      }
    } catch {}
    return response
  }
})()
