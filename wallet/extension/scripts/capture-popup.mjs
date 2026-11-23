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
 await page.locator('#status').waitFor();
 await page.screenshot({path:resolve(folder,'extension-01-idle.png'),fullPage:true});
 const exampleId='visual-example-only';
 await page.evaluate(async ({key,id})=>{
   await chrome.storage.local.set({[key]:{[id]:{
     request:{method:'eth_requestAccounts',availableAccounts:['0x1111111111111111111111111111111111111111']},
     context:{origin:'https://example.test'}
   }}});
 },{key:'420-wallet-pending-approvals-v1',id:exampleId});
 await page.goto(url+'?approval='+exampleId,{waitUntil:'load'});
 await page.locator('#approve').waitFor({state:'visible'});
 await page.screenshot({path:resolve(folder,'extension-02-connect-example.png'),fullPage:true});
 await page.evaluate(async ({key,id})=>{
   await chrome.storage.local.set({[key]:{[id]:{
     request:{method:'personal_sign',params:['0x48656c6c6f','0x1111111111111111111111111111111111111111']},
     context:{origin:'https://example.test'}
   }}});
 },{key:'420-wallet-pending-approvals-v1',id:exampleId});
 await page.reload();
 await page.locator('#approve').waitFor({state:'visible'});
 await page.screenshot({path:resolve(folder,'extension-03-sign-example.png'),fullPage:true});
 console.log('Saved three real extension popup screenshots; example requests are synthetic, no approval submitted.');
}finally{await context.close();}
