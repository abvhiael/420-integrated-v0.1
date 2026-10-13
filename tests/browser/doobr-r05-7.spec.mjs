import {test,expect} from '@playwright/test';
test('R05.7 keyboard focus, semantic names and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/doobr/');
 const main=page.locator('main#main');
 await expect(main).toHaveCount(1);
 await expect(page.getByRole('link',{name:'Skip to main content'})).toHaveCount(1);
 await page.getByRole('link',{name:'Skip to main content'}).focus();
 await page.keyboard.press('Enter');
 await expect(main).toBeFocused();
 const input=page.locator('#region');
 await expect(input).toHaveCount(1);
 await expect(page.locator('label[for="region"]')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Check service status'})).toBeEnabled();
 const unnamed=await page.locator('button,a,input').evaluateAll(nodes=>nodes.filter(el=>{
  if(el.matches('input[type=hidden]'))return false;
  const label=el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent?.trim();
  const labelled=el.getAttribute('aria-labelledby')||el.labels?.length;
  return !label&&!labelled;
 }).length);
 expect(unnamed).toBe(0);
 const info=page.locator('#coverage-response');
 await page.getByRole('button',{name:'Check service status'}).click();
 await expect(info).toHaveAttribute('data-state',/UNKNOWN|UNAVAILABLE/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
});
test('R05.7 private data and commercial operations remain inaccessible',async({page})=>{
 const unsafe=[];
 page.on('request',req=>{const path=new URL(req.url()).pathname;if(req.method()!=='GET'||/private|checkout|pay|orders|device|gps/i.test(path))unsafe.push(req.url())});
 await page.goto('/doobr/');
 await page.getByRole('button',{name:'Check service status'}).click();
 await page.goto('/travel/');
 await expect(page.getByRole('button',{name:'DOOBr checkout unavailable'})).toBeDisabled();
 expect(unsafe).toEqual([]);
});
