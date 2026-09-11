import type {NextConfig} from "next";
const api=(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/,"");
const production=process.env.NODE_ENV==="production";
const basePath=(process.env.NEXT_PUBLIC_BASE_PATH??"").replace(/\/$/,"");
const csp=["default-src 'self'",`script-src 'self' 'unsafe-inline'${production?"":" 'unsafe-eval'"}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: https:","font-src 'self' data:","connect-src 'self' https: http://localhost:* http://127.0.0.1:*","object-src 'none'","base-uri 'self'","frame-ancestors 'none'","form-action 'self'",...(production?["upgrade-insecure-requests"]:[])].join("; ");
const securityHeaders=[
  {key:"Content-Security-Policy",value:csp},
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
  {key:"X-Frame-Options",value:"DENY"},
  ...(production?[{key:"Strict-Transport-Security",value:"max-age=63072000; includeSubDomains; preload"}]:[])
];
const config:NextConfig={
  poweredByHeader:false,
  ...(basePath?{basePath}:{}),
  async rewrites(){return [{source:"/api/v1/:path*",destination:`${api}/v1/:path*`}]},
  async headers(){return [{source:"/:path*",headers:securityHeaders}]}
};
export default config;
