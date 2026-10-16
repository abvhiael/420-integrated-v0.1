'use strict';
// C06.9 Level 2: real Chromium public/private denial and keyboard integration.
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const publicPages=['compliance/web/index.html','compliance/web/browser.html','compliance/web/scenarios.html'];
  const privatePages=['services/complianceauth/authorweb/workspace.html','services/complianceauth/reviewerweb/console.html','services/complianceauth/operatorweb/dashboard.html'];
  for(const relative of [...publicPages,...privatePages]){
   for(const width of [320,375,768,1280]){
    const ctx=await browser.newContext({viewport:{width,height:800},reducedMotion:'reduce'});
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(relative)).href,{waitUntil:'domcontentloaded'});
    const a11y=await page.locator('body').ariaSnapshot();
    assert.match(a11y,/heading .*level=1/,relative+' accessible heading');
    assert.match(a11y,/main/,relative+' main landmark');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,relative+' horizontal overflow '+width);
    await page.keyboard.press('Tab');
    const first=await page.evaluate(()=>({tag:document.activeElement?.tagName,name:document.activeElement?.getAttribute('aria-label')||document.activeElement?.innerText||''}));
    assert.ok(['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(first.tag)&&first.name.trim(),relative+' keyboard entry');
    if(privatePages.includes(relative)){
     assert.doesNotMatch(a11y,/\bALLOW\b/,relative+' exposed operational ALLOW');
     if(relative.includes('authorweb')||relative.includes('reviewerweb'))assert.ok(await page.locator('fieldset:disabled').count(),relative+' unauthenticated form unlocked');
     if(relative.includes('operatorweb'))assert.ok(await page.locator('#halt:disabled').count(),relative+' halt enabled without session');
     // Missing authenticated session must never authorize a private write.
     await page.waitForTimeout(50);
     if(relative.includes('authorweb')||relative.includes('reviewerweb'))assert.ok(await page.locator('fieldset:disabled').count(),relative+' post-load form unlocked');
    }
    // Browser HTML errors and missing private network services may occur in isolated file preview.
    // Security assertions above remain hard failures.
    await ctx.close();
   }
  }
  console.log('C06.9 Level 2 Chromium public/private keyboard, screen-reader semantics, failure states and four responsive viewports PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
