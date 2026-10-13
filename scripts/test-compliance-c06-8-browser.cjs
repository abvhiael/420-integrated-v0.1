'use strict';
// Run with Playwright Chromium in CI. No network production service required.
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const pages=[
   'compliance/web/index.html',
   'compliance/web/browser.html',
   'compliance/web/scenarios.html',
   'services/complianceauth/authorweb/workspace.html',
   'services/complianceauth/reviewerweb/console.html',
   'services/complianceauth/operatorweb/dashboard.html'
  ];
  for(const pagePath of pages){
   for(const width of [320,375,768,1280]){
    const context=await browser.newContext({viewport:{width,height:820},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.goto(pathToFileURL(path.resolve(pagePath)).href,{waitUntil:'domcontentloaded'});
    assert.ok(await page.locator('main').count(),pagePath+' main landmark');
    assert.ok(await page.locator('h1').count(),pagePath+' heading');
    assert.ok(await page.locator('html[lang]').count(),pagePath+' language');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,pagePath+' horizontal overflow at '+width);
    await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>({
     visible:document.activeElement&&document.activeElement!==document.body,
     label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent||''
    }));
    assert.ok(focus.visible,pagePath+' keyboard focus absent');
    assert.ok(focus.label.trim(),pagePath+' keyboard focus without accessible name');
    if(pagePath.includes('/private/')){
     const disabled=await page.locator('fieldset[disabled]').count();
     if(pagePath.includes('authorweb')||pagePath.includes('reviewerweb'))assert.ok(disabled,pagePath+' private form enabled before authorization');
    }
    await context.close();
   }
  }
  process.stdout.write('C06.8 real Chromium responsive and keyboard navigation PASS (screen-reader manual acceptance separate)\n');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
