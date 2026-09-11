import{defineConfig}from"@playwright/test";
const baseURL=process.env.PLAYWRIGHT_BASE_URL??"http://127.0.0.1:3000";
export default defineConfig({testDir:"./test",use:{baseURL,trace:"retain-on-failure"},...(process.env.PLAYWRIGHT_BASE_URL?{}:{webServer:{command:"pnpm dev",url:"http://127.0.0.1:3000",reuseExistingServer:true,timeout:120000}})});
