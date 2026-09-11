import{z}from"zod";
export const serverEnvSchema=z.object({
 NODE_ENV:z.enum(["development","test","production"]).default("development"),
 APP_ENV:z.enum(["development","test","staging","production"]).default("development"),
 APP_URL:z.string().url().default("http://localhost:3000"),API_URL:z.string().url().default("http://localhost:4000"),
 DATABASE_URL:z.string().min(1),REDIS_URL:z.string().url().default("redis://localhost:6379"),
 ONEDELTA_API_BASE_URL:z.string().url().default("https://portal.1delta.io/v1"),ONEDELTA_API_KEY:z.string().optional(),ONEDELTA_CHAIN_ALLOWLIST:z.string().optional(),
 PENDLE_API_BASE_URL:z.string().url().default("https://api-v2.pendle.finance/core"),PENDLE_API_KEY:z.string().optional(),
 RATE_NOTIONAL_GRID:z.string().default("10000,50000,100000,250000,500000,1000000,2500000,5000000,10000000"),RATE_HORIZON_GRID:z.string().default("30,90,180,365"),RATE_ASSET_GROUPS:z.string().default("USDC,USDT,DAI,USDE,ETH,BTC"),
 LOG_LEVEL:z.string().default("info"),API_PORT:z.coerce.number().int().positive().default(4000),WORKER_CONCURRENCY:z.coerce.number().int().min(1).max(32).default(4),
 STALE_LENDING_SECONDS:z.coerce.number().int().positive().default(300),STALE_PENDLE_SECONDS:z.coerce.number().int().positive().default(300),STALE_DEPTH_SECONDS:z.coerce.number().int().positive().default(1800),STALE_HISTORY_SECONDS:z.coerce.number().int().positive().default(7200),SENTRY_DSN:z.string().optional()
});
export type ServerEnv=z.infer<typeof serverEnvSchema>;
export const loadServerEnv=(source:NodeJS.ProcessEnv=process.env)=>serverEnvSchema.parse(source);
export function chainAllowlist(env:ServerEnv){if(!env.ONEDELTA_CHAIN_ALLOWLIST?.trim())return null;return env.ONEDELTA_CHAIN_ALLOWLIST.split(",").map(v=>v.trim()).filter(Boolean);}
export const rateNotionalGrid=(env:ServerEnv)=>env.RATE_NOTIONAL_GRID.split(",").map(Number).filter(v=>Number.isFinite(v)&&v>0);
export const rateHorizonGrid=(env:ServerEnv)=>env.RATE_HORIZON_GRID.split(",").map(Number).filter(v=>Number.isInteger(v)&&v>0);
export const rateAssetGroups=(env:ServerEnv)=>env.RATE_ASSET_GROUPS.split(",").map(v=>v.trim()).filter(Boolean);
