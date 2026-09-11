import{test,expect}from"@playwright/test";

const viewports=[
 {name:"desktop-1440",width:1440,height:1000},
 {name:"desktop-1280",width:1280,height:900},
 {name:"tablet-1024",width:1024,height:768},
 {name:"mobile-390",width:390,height:844},
 {name:"mobile-430",width:430,height:932}
] as const;
const pages=["/","/markets","/rates?asset=usdc&notional=100000&horizon=90","/datasets"] as const;

for(const viewport of viewports)for(const theme of["light","dark"] as const){
 test(`visual QA ${viewport.name} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.addInitScript(value=>localStorage.setItem("tokos-data-theme",value),theme);
  for(const route of pages){
   await page.goto(route);
   await expect(page.locator("header")).toBeVisible();
   await page.waitForLoadState("networkidle");
   const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth,brokenImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).length}));
   expect(layout.brokenImages,`${route} has broken images`).toBe(0);
   expect(layout.scrollWidth,`${route} overflows viewport`).toBeLessThanOrEqual(layout.innerWidth+1);
   const routePath=route.split("?")[0]??"";
   const slug=route==="/"?"home":routePath.replace(/^\//,"").replaceAll("/","-");
   await page.screenshot({path:testInfo.outputPath(`${viewport.name}-${theme}-${slug}.png`),fullPage:true});
  }
 });
}
