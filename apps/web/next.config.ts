import type {NextConfig} from "next";
const api=(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/,"");
const config:NextConfig={
  poweredByHeader:false,
  typescript:{ignoreBuildErrors:true},
  async rewrites(){return [{source:"/api/v1/:path*",destination:`${api}/v1/:path*`}]},
  async headers(){return [{source:"/:path*",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}
  ]}]}
};
export default config;
