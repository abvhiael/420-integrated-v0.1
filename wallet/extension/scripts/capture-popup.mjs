import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=resolve(root,'visual-captures');
mkdirSync(folder,{recursive:true});
const context=await chromium.launchPersistentContext('',{
  channel:'chromium',headless:true,
  viewport:{width:430,height:660},deviceScaleFactor:2,
  args:['--disable-extensions-except='+root,'--load-extension='+root]
});
try {
 let worker=context.serviceWorkers()[0];
 if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:20000});
 const extensionId=new URL(worker.url()).host;
 console.log('Loaded real extension',extensionId);
 const page=await context.newPage();
 const url='chrome-extension://'+extensionId+'/popup.html';
 await page.goto(url,{waitUntil:'load'});
 await page.locator('#primary-content').waitFor({state:'visible'});
 await page.locator('#dashboard').waitFor({state:'visible'});
 await page.screenshot({path:resolve(folder,'extension-01-idle.png'),fullPage:true});
 // The actual extension renders synthetic *visual fixtures* only; no approval is created.
 // Directly reveal the existing approval view, with action controls disabled.
 const showExample=async (method,description)=>{
   await page.evaluate(({method,description})=>{
     document.querySelectorAll('.view').forEach(view=>{view.hidden=view.id!=='approval-view';});
     document.querySelector('#bottom-nav').hidden=true;
     document.querySelector('#status').textContent='Example request — visual-only, not actionable';
     document.querySelector('#request').hidden=false;
     document.querySelector('#actions').hidden=false;
     document.querySelector('#kind').textContent=method;
     document.querySelector('#origin').textContent='https://example.test (synthetic)';
     document.querySelector('#details').textContent=description;
     document.querySelector('#approve').disabled=true;
     document.querySelector('#reject').disabled=true;
   },{method,description});
   await page.locator('#approval-view').waitFor({state:'visible'});
 };
 await showExample('eth_requestAccounts','Example account: 0x1111111111111111111111111111111111111111');
 await page.screenshot({path:resolve(folder,'extension-02-connect-example.png'),fullPage:true});
 await showExample('personal_sign','Example message: Hello (not signed)');
 await page.screenshot({path:resolve(folder,'extension-03-sign-example.png'),fullPage:true});
 console.log('Saved three real extension popup screenshots; example requests are synthetic, no approval submitted.');
}finally{await context.close();}
