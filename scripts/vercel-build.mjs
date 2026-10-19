// Vercel build for apps/web. The repo aliases `typescript` to @typescript/typescript6, which ships no `tsc` bin,
// so expose one (as the Dockerfile does), build the workspace packages, then build the Next.js app.
import {execSync} from "node:child_process";
import {chmodSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(new URL("..",import.meta.url).pathname);
const tsc=execSync(`find ${root}/node_modules/.pnpm -type f -path '*/node_modules/@typescript/typescript6/lib/tsc.js' | head -n1`,{encoding:"utf8"}).trim();
if(!tsc)throw new Error("typescript6 tsc.js not found");
mkdirSync(`${root}/node_modules/.bin`,{recursive:true});
writeFileSync(`${root}/node_modules/.bin/tsc`,`#!/bin/sh\nexec node "${tsc}" "$@"\n`);chmodSync(`${root}/node_modules/.bin/tsc`,0o755);
const env={...process.env,PATH:`${root}/node_modules/.bin:${process.env.PATH}`,NODE_ENV:"production"};
execSync("pnpm build:packages",{cwd:root,stdio:"inherit",env});
execSync("pnpm exec next build",{cwd:`${root}/apps/web`,stdio:"inherit",env});
