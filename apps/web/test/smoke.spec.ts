import{test,expect}from"@playwright/test";

test("research flow works with live normalized data",async({page,request})=>{
 await page.goto("/");
 await expect(page.locator("header")).toContainText("tokos");
 await expect(page.getByRole("heading",{name:"Overview"})).toBeVisible();

 await page.getByRole("button",{name:/Search markets, assets, protocols/i}).click();
 const search=page.getByRole("textbox",{name:"Search"});
 await search.fill("USDC");
 const firstResult=page.locator(".command-result").filter({hasNotText:"No matching entities."}).first();
 await expect(firstResult).toBeVisible();
 await firstResult.click();
 await expect(page).toHaveURL(/\/(asset|market|protocol|chain)\//);

 await page.goto("/markets");
 await expect(page.getByRole("heading",{name:"Markets"})).toBeVisible();
 const marketLinks=page.locator('a[href*="/market/"]');
 await expect(marketLinks.first()).toBeVisible();
 const h1=await marketLinks.nth(0).getAttribute("href"),h2=await marketLinks.nth(1).getAttribute("href");
 if(h1&&h2){const id1=decodeURIComponent(h1.split("/market/")[1]??""),id2=decodeURIComponent(h2.split("/market/")[1]??"");await page.goto(`/compare?markets=${encodeURIComponent(id1)},${encodeURIComponent(id2)}`);await expect(page.getByRole("heading",{name:"Compare"})).toBeVisible()}

 await page.goto("/rates?asset=usdc&notional=100000&horizon=90");
 await expect(page.getByRole("heading",{name:"Rates"})).toBeVisible();
 const notional=page.getByLabel("Notional");
 await notional.selectOption("1000000");
 await expect(page).toHaveURL(/notional=1000000/);
 await page.reload();
 await expect(page.getByLabel("Notional")).toHaveValue("1000000");

 for(const [route,title] of [["/yield-curve?asset=usdc&notional=100000","Yield Curve"],["/basis","Basis"],["/execution","Liquidity"]] as const){await page.goto(route);await expect(page.getByRole("heading",{name:title})).toBeVisible()}

 const csv=await request.get("/api/v1/export/markets.csv?limit=10");
 expect(csv.ok()).toBeTruthy();
 expect(csv.headers()["content-type"]??"").toContain("text/csv");
 expect((await csv.text()).split("\n").length).toBeGreaterThan(1);

 await page.goto("/datasets");
 await expect(page.getByRole("heading",{name:"Datasets"})).toBeVisible();
});

test("stale warning is visible when normalized observations expire",async({page})=>{
 test.skip(process.env.STALE_BROWSER_TEST!=="1","stale-state pass runs after the live research flow");
 await page.goto("/");
 await expect(page.getByText(/Stale observations detected/)).toBeVisible();
});
