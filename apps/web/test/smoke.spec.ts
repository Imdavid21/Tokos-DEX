import{test,expect}from"@playwright/test";

test("research flow works with live normalized data",async({page,request})=>{
 await page.goto("/");
 await expect(page.locator("header")).toContainText("tokos");

 await page.getByRole("button",{name:/Search markets, assets, protocols/i}).click();
 const search=page.getByRole("textbox",{name:"Search"});
 await search.fill("USDC");
 const firstResult=page.locator(".command-result").filter({hasNotText:"No matching entities."}).first();
 await expect(firstResult).toBeVisible();
 await firstResult.click();
 await expect(page).toHaveURL(/\/(asset|market|protocol|chain)\//);

 await page.goto("/markets");
 await expect(page.getByRole("heading",{name:"Markets"})).toBeVisible();
 const checks=page.getByRole("checkbox");
 await expect(checks.first()).toBeVisible();
 await checks.nth(0).check();
 await checks.nth(1).check();
 await page.getByRole("button",{name:"Compare selected"}).click();
 await expect(page).toHaveURL(/\/compare\?markets=/);
 await expect(page.getByRole("heading",{name:"Compare"})).toBeVisible();

 await page.goto("/rates?asset=usdc&notional=100000&horizon=90");
 await expect(page.getByRole("heading",{name:/USDC rates/i})).toBeVisible();
 const notional=page.getByLabel("Notional");
 await notional.selectOption("1000000");
 await expect(page).toHaveURL(/notional=1000000/);
 await page.reload();
 await expect(page.getByLabel("Notional")).toHaveValue("1000000");

 const csv=await request.get("/api/v1/export/markets.csv?limit=10");
 expect(csv.ok()).toBeTruthy();
 expect(csv.headers()["content-type"]??"").toContain("text/csv");
 expect((await csv.text()).split("\n").length).toBeGreaterThan(1);

 await page.goto("/datasets");
 await expect(page.getByRole("heading",{name:"Datasets"})).toBeVisible();
});
