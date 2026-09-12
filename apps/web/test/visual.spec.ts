import{test,expect}from"@playwright/test";

const viewports=[
 {name:"desktop-1440",width:1440,height:1000},
 {name:"desktop-1280",width:1280,height:900},
 {name:"tablet-1024",width:1024,height:768},
 {name:"mobile-390",width:390,height:844},
 {name:"mobile-430",width:430,height:932}
] as const;
const pages=["/","/markets","/rates?asset=usdc&notional=100000&horizon=90","/yield-curve?asset=usdc&notional=100000","/basis","/execution","/correlations","/assets","/protocols","/chains","/compare","/datasets","/metrics"] as const;

for(const viewport of viewports)for(const theme of["light","dark"] as const){
 test(`visual QA ${viewport.name} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.addInitScript(value=>localStorage.setItem("tokos-data-theme",value),theme);
  for(const route of pages){
   await page.goto(route);
   await expect(page.locator("header")).toBeVisible();
   await page.waitForLoadState("networkidle");
   const layout=await page.evaluate(()=>{
    const px=(v:string)=>Number.parseFloat(v)||0;
    const overlaps=(nodes:Element[])=>nodes.some((a,i)=>nodes.slice(i+1).some(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();if(x.width===0||x.height===0||y.width===0||y.height===0)return false;return x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top&&Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2}));
    const bodyStyle=getComputedStyle(document.body),title=document.querySelector(".page-title"),table=document.querySelector("table.data"),nav=document.querySelector(".nav-link"),controls=[...document.querySelectorAll("button,.btn,.input,.select")];
    const gridPanels=[...document.querySelectorAll(".analytics-grid > .panel")];
    return{
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth:window.innerWidth,
      brokenImages:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).length,
      bodyFont:px(bodyStyle.fontSize),
      titleFont:title?px(getComputedStyle(title).fontSize):null,
      tableFont:table?px(getComputedStyle(table).fontSize):null,
      navHeight:nav?nav.getBoundingClientRect().height:null,
      minControlHeight:controls.length?Math.min(...controls.map(x=>x.getBoundingClientRect().height).filter(Boolean)):null,
      panelOverlap:overlaps(gridPanels)
    }
   });
   expect(layout.brokenImages,`${route} has broken images`).toBe(0);
   expect(layout.scrollWidth,`${route} overflows viewport`).toBeLessThanOrEqual(layout.innerWidth+1);
   expect(layout.bodyFont,`${route} body font is too small`).toBeGreaterThanOrEqual(viewport.width<800?13:13.5);
   if(layout.titleFont!=null)expect(layout.titleFont,`${route} title is too small`).toBeGreaterThanOrEqual(20);
   if(layout.tableFont!=null)expect(layout.tableFont,`${route} table text is too small`).toBeGreaterThanOrEqual(12);
   if(layout.navHeight!=null)expect(layout.navHeight,`${route} nav rows are too cramped`).toBeGreaterThanOrEqual(32);
   if(layout.minControlHeight!=null)expect(layout.minControlHeight,`${route} has undersized controls`).toBeGreaterThanOrEqual(26);
   expect(layout.panelOverlap,`${route} has overlapping analytical panels`).toBe(false);
   const routePath=route.split("?")[0]??"";
   const slug=route==="/"?"home":routePath.replace(/^\//,"").replaceAll("/","-");
   await page.screenshot({path:testInfo.outputPath(`${viewport.name}-${theme}-${slug}.png`),fullPage:true});
  }
 });
}
