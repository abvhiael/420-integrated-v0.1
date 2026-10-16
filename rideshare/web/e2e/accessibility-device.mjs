import { chromium } from 'playwright';
import axe from 'axe-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({headless:true});
const url = 'http://127.0.0.1:8032/';
try {
  for (const viewport of [{width:390,height:844},{width:1280,height:800}]) {
    const page=await browser.newPage({viewport, reducedMotion:'reduce'});
    await page.addInitScript(()=>{globalThis.LIFTdSessionAdapter={getSession:async()=>({status:'unauthenticated'})};});
    await page.goto(url,{waitUntil:'networkidle'});
    await page.locator('#main h1').waitFor();
    assert.equal(await page.locator('a[data-route][href="/rider"]').count(),1);
    if(viewport.width<650){
      await page.locator('#menu-toggle').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
      await page.locator('#menu-toggle').click();
    }
    await page.locator('a[data-route][href="/rider"]').click();
    await page.waitForURL('**/rider');
    assert.match(await page.locator('#main').innerText(),/independently verified/i);
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'main');
    const violations=await page.evaluate(async script=>{
      (0,eval)(script);
      return (await globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));
    },axe.source);
    assert.deepEqual(violations,[],'axe violations: '+JSON.stringify(violations));
    await page.close();
  }
  const page=await browser.newPage();
  await page.addInitScript(()=>{globalThis.LIFTdSessionAdapter={getSession:async()=>({status:'unauthenticated'})};});
  await page.goto(url);
  await page.locator('a[data-route][href="/driver"]').click();
  await page.waitForURL('**/driver');
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  assert.match(await page.locator('#main').innerText(),/connection unavailable/i);
  assert.match(await page.locator('#main').innerText(),/access remains blocked/i);
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByText(/independently verified, active session is required/i).waitFor();
  assert.doesNotMatch(await page.locator('#main').innerText(),/driver workspace — preview only/i);
  await page.close();
} finally {await browser.close();}
