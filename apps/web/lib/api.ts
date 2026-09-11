export type Envelope<T>={data:T;meta:{asOf:string;stale:boolean;requestId:string;nextCursor?:string|null;hasMore?:boolean}};
const serverBase=(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/,"");
export async function api<T>(path:string, init?:RequestInit):Promise<Envelope<T>>{
  const url=typeof window==="undefined"?`${serverBase}/v1${path}`:`/api/v1${path}`;
  const r=await fetch(url,{...init,headers:{accept:"application/json",...init?.headers},next:typeof window==="undefined"?{revalidate:30}:undefined});
  if(!r.ok){let message=`API ${r.status}`;try{const j=await r.json();message=j?.error?.message??message}catch{}throw new Error(message)}
  return r.json();
}
export async function maybeApi<T>(path:string):Promise<Envelope<T>|null>{try{return await api<T>(path)}catch{return null}}
export function qs(params:Record<string,string|number|boolean|undefined|null>){const s=new URLSearchParams();for(const [k,v] of Object.entries(params)){if(v!==undefined&&v!==null&&v!=="")s.set(k,String(v))}return s.toString()}
