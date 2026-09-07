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
const GT_BASE = 'https://api.geckoterminal.com/api/v2'
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const INTEGER = /^\d+$/
const ZERO = '0x0000000000000000000000000000000000000000'
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const MIME = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.ico':'image/x-icon','.webp':'image/webp' }

const buckets = new Map()
const cache = new Map()
function cached(key, ttl, loader) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value)
  return Promise.resolve(loader()).then(value => { cache.set(key, { at: Date.now(), value }); return value })
}
function rateLimited(ip) {
  const now=Date.now(), windowMs=60_000, max=120, current=buckets.get(ip)
  if(!current||now-current.started>windowMs){buckets.set(ip,{started:now,count:1});return false}
  current.count+=1; return current.count>max
}
function securityHeaders(extra={}) { return {
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'", ...extra
}}
function json(res,status,body){const payload=JSON.stringify(body);res.writeHead(status,securityHeaders({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(payload)}));res.end(payload)}
function short(value){return `${value.slice(0,6)}…${value.slice(-4)}`}

function getParams(url,mode){
  const chainId=url.searchParams.get('chainId'),tokenIn=url.searchParams.get('tokenIn'),tokenOut=url.searchParams.get('tokenOut'),amount=url.searchParams.get('amount'),slippage=url.searchParams.get('slippage')||'50',account=url.searchParams.get('account')
  if(!chainId||!INTEGER.test(chainId)||Number(chainId)<=0)return{error:'Invalid chain'}
  if(!tokenIn||!ADDRESS.test(tokenIn)||!tokenOut||!ADDRESS.test(tokenOut))return{error:'Invalid token address'}
  if(!amount||!INTEGER.test(amount)||BigInt(amount)<=0n)return{error:'Invalid amount'}
  if(!INTEGER.test(slippage)||Number(slippage)<0||Number(slippage)>10_000)return{error:'Invalid slippage'}
  if(mode==='build'&&(!account||!ADDRESS.test(account)))return{error:'Connect a valid wallet'}
  const params=new URLSearchParams({chainId,tokenIn,tokenOut,amount,slippage,tradeType:'0'}); if(mode==='build')params.set('account',account)
  return{params,account,chainId,tokenIn,tokenOut,amount,slippage}
}
async function proxyRouting(res,url,mode){
  if(!ROUTING_API_BASE_URL)return json(res,503,{success:false,error:{message:'Routing service is not configured'}})
  const parsed=getParams(url,mode);if(parsed.error)return json(res,400,{success:false,error:{message:parsed.error}})
  try{
    const headers={Accept:'application/json'};if(ROUTING_API_KEY)headers['x-api-key']=ROUTING_API_KEY
    const upstream=await fetch(`${ROUTING_API_BASE_URL}${SPOT_SWAP_PATH}?${parsed.params}`,{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(12_000)})
    const text=await upstream.text();let body;try{body=JSON.parse(text)}catch{body=null}
    if(!upstream.ok||!body)return json(res,upstream.status>=400?upstream.status:502,{success:false,error:{message:body?.error?.message||'Routing service is unavailable'}})
    return json(res,200,body)
  }catch{return json(res,502,{success:false,error:{message:'Routing service is temporarily unavailable'}})}
}
async function directBenchmark(res,url){
  if(!DIRECT_MARKET_API_KEY)return json(res,503,{success:false,error:{code:'NOT_CONFIGURED',message:'Direct benchmark is not configured'}})
  const parsed=getParams(url,'build');if(parsed.error)return json(res,400,{success:false,error:{message:parsed.error}})
  try{
    const upstream=await fetch(DIRECT_QUOTE_URL,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','x-api-key':DIRECT_MARKET_API_KEY,'x-universal-router-version':'2.0','x-erc20eth-enabled':'true'},body:JSON.stringify({type:'EXACT_INPUT',amount:parsed.amount,tokenInChainId:Number(parsed.chainId),tokenOutChainId:Number(parsed.chainId),tokenIn:parsed.tokenIn,tokenOut:parsed.tokenOut,swapper:parsed.account,slippageTolerance:Number(parsed.slippage)/100}),signal:AbortSignal.timeout(10_000)})
    const body=await upstream.json().catch(()=>null);if(!upstream.ok||!body)return json(res,502,{success:false,error:{message:'Direct benchmark is unavailable'}})
    return json(res,200,{success:true,data:{amountOut:body?.quote?.output?.amount,gasEstimateUsd:body?.quote?.classicGasUseEstimateUSD,routing:body?.routing}})
  }catch{return json(res,502,{success:false,error:{message:'Direct benchmark is unavailable'}})}
}

function gtHeaders(){return{Accept:'application/json;version=20230203'}}
async function gt(path,ttl=60_000){return cached(`gt:${path}`,ttl,async()=>{const r=await fetch(`${GT_BASE}${path}`,{headers:gtHeaders(),signal:AbortSignal.timeout(8_000)});const body=await r.json().catch(()=>null);if(!r.ok||!body)throw new Error('market data unavailable');return body})}
function marketAddress(address){return address.toLowerCase()===ZERO?WETH:address}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)?n:null}

async function tokenInfo(address){
  const target=marketAddress(address)
  try{
    const body=await gt(`/networks/eth/tokens/${target}/info`,300_000),a=body?.data?.attributes||{}
    return{address,symbol:a.symbol||null,name:a.name||null,decimals:Number.isInteger(Number(a.decimals))?Number(a.decimals):null,image:a.image_url||null,coingeckoCoinId:a.coingecko_coin_id||null}
  }catch{return{address,symbol:address.toLowerCase()===ZERO?'ETH':null,name:address.toLowerCase()===ZERO?'Ether':null,decimals:address.toLowerCase()===ZERO?18:null,image:null}}
}
async function tokenData(res,url){const address=url.searchParams.get('address');if(!address||!ADDRESS.test(address))return json(res,400,{success:false,error:{message:'Invalid token address'}});return json(res,200,{success:true,data:await tokenInfo(address)})}

async function getTopPool(target){
  const body=await gt(`/networks/eth/tokens/${target}/pools?page=1`,45_000)
  const pools=(body?.data||[]).filter(p=>ADDRESS.test(p?.attributes?.address||''))
  pools.sort((a,b)=>Number(b?.attributes?.reserve_in_usd||0)-Number(a?.attributes?.reserve_in_usd||0))
  return pools[0]||null
}
async function marketData(res,url){
  const address=url.searchParams.get('address'),daysRaw=url.searchParams.get('days')||'30'
  if(!address||!ADDRESS.test(address))return json(res,400,{success:false,error:{message:'Invalid token address'}})
  const days=Math.min(Math.max(Number(daysRaw)||30,1),180),target=marketAddress(address)
  const key=`market:${target.toLowerCase()}:${days}`
  try{
    const data=await cached(key,45_000,async()=>{
      const [token,pool]=await Promise.all([gt(`/networks/eth/tokens/${target}`,45_000),getTopPool(target)])
      const attrs=token?.data?.attributes||{}
      let prices=[]
      if(pool){
        const timeframe=days<=1?'hour':days<=30?'hour':'day'
        const aggregate=days<=1?1:days<=7?4:days<=30?12:1
        const limit=days<=1?24:days<=7?42:days<=30?60:Math.min(days,180)
        const poolAddress=pool.attributes.address
        const ohlcv=await gt(`/networks/eth/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${target}`,45_000)
        prices=(ohlcv?.data?.attributes?.ohlcv_list||[]).map(c=>[Number(c[0])*1000,Number(c[4])]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).reverse()
      }
      const daily=pool?.attributes||{}
      return{
        address,symbol:attrs.symbol||null,name:attrs.name||null,image:attrs.image_url||null,priceUsd:numberOrNull(attrs.price_usd),
        priceChange24h:numberOrNull(attrs.price_change_percentage?.h24),marketCapUsd:numberOrNull(attrs.market_cap_usd),fdvUsd:numberOrNull(attrs.fdv_usd),
        volume24hUsd:numberOrNull(attrs.volume_usd?.h24??daily.volume_usd?.h24),
        high:prices.length?Math.max(...prices.slice(-24).map(x=>x[1])):null,low:prices.length?Math.min(...prices.slice(-24).map(x=>x[1])):null,
        pool:pool?{address:pool.attributes.address,name:pool.attributes.name||null,dex:pool?.relationships?.dex?.data?.id||null,liquidityUsd:numberOrNull(pool.attributes.reserve_in_usd)}:null,
        prices
      }
    })
    return json(res,200,{success:true,data})
  }catch{return json(res,200,{success:true,data:{address,prices:[]}})}
}

async function tokenSearch(res,url){
  const q=String(url.searchParams.get('q')||'').trim();if(!q)return json(res,200,{success:true,data:[]})
  if(ADDRESS.test(q)){const info=await tokenInfo(q);return json(res,200,{success:true,data:[{...info,symbol:info.symbol||short(q),name:info.name||'ERC-20 token'}]})}
  try{
    const body=await gt(`/search/pools?query=${encodeURIComponent(q)}&network=eth&include=base_token,quote_token&page=1`,60_000),seen=new Set(),out=[]
    const included=body?.included||[]
    for(const pool of body?.data||[]){
      for(const rel of [pool?.relationships?.base_token?.data,pool?.relationships?.quote_token?.data]){
        if(!rel?.id||seen.has(rel.id))continue
        const token=included.find(x=>x.type==='token'&&x.id===rel.id),a=token?.attributes||{},address=rel.id.split('_').pop()
        if(!ADDRESS.test(address))continue
        seen.add(rel.id);out.push({address,symbol:a.symbol||short(address),name:a.name||'Token',decimals:Number.isInteger(Number(a.decimals))?Number(a.decimals):null,image:a.image_url||null})
        if(out.length>=18)break
      }
      if(out.length>=18)break
    }
    return json(res,200,{success:true,data:out})
  }catch{return json(res,200,{success:true,data:[]})}
}

async function serveFile(req,res,pathname){
  const requestPath=pathname==='/'?'/index.html':pathname,safePath=normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/,'');let filePath=join(ROOT,safePath)
  try{const info=await stat(filePath);if(info.isDirectory())filePath=join(filePath,'index.html');const data=await readFile(filePath);res.writeHead(200,securityHeaders({'Content-Type':MIME[extname(filePath)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':data.length}));res.end(data)}
  catch{try{const data=await readFile(join(ROOT,'index.html'));res.writeHead(200,securityHeaders({'Content-Type':MIME['.html'],'Cache-Control':'no-store'}));res.end(data)}catch{res.writeHead(404,securityHeaders());res.end('Not found')}}
}

const server=createServer(async(req,res)=>{
  const ip=req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()||req.socket.remoteAddress||'unknown';if(rateLimited(ip))return json(res,429,{success:false,error:{message:'Too many requests'}})
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`)
  if(url.pathname==='/health')return json(res,200,{ok:true,service:'tokos-dex',routingConfigured:Boolean(ROUTING_API_BASE_URL),directBenchmarkConfigured:Boolean(DIRECT_MARKET_API_KEY),feeBps:Number.isFinite(FEE_BPS)?FEE_BPS:0,feeRecipientConfigured:Boolean(FEE_RECIPIENT)})
  if(url.pathname==='/api/quote'&&req.method==='GET')return proxyRouting(res,url,'quote')
  if(url.pathname==='/api/build'&&req.method==='GET')return proxyRouting(res,url,'build')
  if(url.pathname==='/api/benchmark'&&req.method==='GET')return directBenchmark(res,url)
  if(url.pathname==='/api/token'&&req.method==='GET')return tokenData(res,url)
  if(url.pathname==='/api/token/search'&&req.method==='GET')return tokenSearch(res,url)
  if(url.pathname==='/api/market'&&req.method==='GET')return marketData(res,url)
  if(url.pathname.startsWith('/api/'))return json(res,404,{success:false,error:{message:'Not found'}})
  return serveFile(req,res,url.pathname)
})
server.listen(PORT,'0.0.0.0',()=>console.log(`Tokos DEX listening on :${PORT}`))