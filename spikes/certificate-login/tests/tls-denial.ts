import {expect,type Page} from '@playwright/test';
export async function expectTlsDenied(page:Page,url:string,reason:RegExp){
  const result=await page.goto(url,{timeout:10000}).catch((error:unknown)=>error);
  if(result instanceof Error){expect(result.message).toMatch(reason);return;}
  // 1.61.0's context-certificate proxy renders upstream TLS failures as 503.
  expect(await page.locator('body').textContent()).toMatch(/Playwright client-certificate error/);
  expect(await page.locator('body').textContent()).toMatch(reason);
  await expect(page.locator('#login')).toHaveCount(0);
}
