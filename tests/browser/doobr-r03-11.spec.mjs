import {test,expect} from '@playwright/test';

test('DOOBr public journey stays non-transactional and responds to keyboard',async({page},testInfo)=>{
 await page.goto('/doobr/');
 await expect(page.getByRole('heading',{name:'DOOBr is in development.'})).toBeVisible();
 await expect(page.getByText('No cannabis orders, eligibility determinations or payments are being accepted.')).toBeVisible();
 await expect(page.locator('input[type=password],input[type=email],input[type=number],input[autocomplete*="address"]')).toHaveCount(0);
 await expect(page.locator('form')).toHaveCount(1);
 await expect(page.locator('a[href*="checkout"],button:has-text("Pay now"),button:has-text("Purchase")')).toHaveCount(0);
 const status=page.locator('#coverage-response');
 await page.getByRole('button',{name:'Check service status'}).click();
 await expect(status).toHaveAttribute('data-state',/UNKNOWN|UNAVAILABLE/);
 await expect(status).toContainText(/unverified|not operational|unavailable|unknown/i);
 await page.keyboard.press('Tab');
 await expect(page.locator(':focus')).toHaveCount(1);
 await page.getByRole('link',{name:'Skip to main content'}).focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main')).toBeFocused();
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('link',{name:'Coverage'})).toBeVisible();
 const label=await page.locator('label[for=region]').count();
 expect(label).toBe(1);
 if(testInfo.project.name==='mobile-touch'){
  await expect(page.getByRole('heading',{name:'Check regional coverage'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);
 }
});

test('420Travel deep link preserves denied checkout',async({page})=>{
 await page.goto('/travel/');
 await expect(page.getByRole('heading',{name:'DOOBr regional presence'})).toBeVisible();
 await expect(page.getByText('Current regional presence:',{exact:false})).toContainText('Unknown');
 const go=page.getByRole('link',{name:'View DOOBr coverage information'});
 await expect(go).toHaveAttribute('href','https://doobr.420integrated.org/coverage');
 const button=page.getByRole('button',{name:'DOOBr checkout unavailable'});
 await expect(button).toBeDisabled();
 await expect(page.locator('#doobr-coarse-presence')).not.toContainText(/courier coordinates|delivery address|recipient identity/i);
});

test('no live API, payment or private location access from static DOOBr journeys',async({page})=>{
 const attempts=[];
 page.on('request',request=>{if(request.method()!=='GET' || /\/private\/|\/checkout|\/payment|\/orders/i.test(new URL(request.url()).pathname))attempts.push(request.url())});
 await page.goto('/doobr/');
 await page.getByRole('button',{name:'Check service status'}).click();
 await page.getByRole('link',{name:'Courier journey'}).click();
 await page.getByRole('link',{name:'Retailers'}).click();
 expect(attempts).toEqual([]);
});
