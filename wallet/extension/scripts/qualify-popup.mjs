import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {buildExtension420} from './build.mjs';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {dist:root}=await buildExtension420();
const screenshots=resolve(sourceRoot,'visual-evidence');
mkdirSync(screenshots,{recursive:true});
const controller='0x1111111111111111111111111111111111111111';
const factory='0x2222222222222222222222222222222222222222';
const account='0x3333333333333333333333333333333333333333';
const addressWord=a=>'0x'+a.slice(2).padStart(64,'0');
const rpc=createServer(async(req,res)=>{
  const parts=[];
  for await(const chunk of req)parts.push(chunk);
  const body=JSON.parse(Buffer.concat(parts).toString());
  const method=body.method;
  let result;
  if(method==='eth_chainId')result='0x1a4';
  else if(method==='eth_blockNumber')result='0x200';
  else if(method==='eth_getCode')result='0x6001600055';
  else if(method==='eth_getBalance')result='0x16c4abbebea0100000';
  else if(method==='eth_call')result=body.params?.[0]?.to?.toLowerCase()===factory?addressWord(account):addressWord(controller);
  else {res.writeHead(400).end(JSON.stringify({error:{message:'Unsupported local fixture method'}}));return;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:body.id,result}));
});
await new Promise(resolve=>rpc.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launchPersistentContext('',{
  channel:'chromium',headless:true,viewport:{width:410,height:640},deviceScaleFactor:2,
  args:['--disable-extensions-except='+root,'--load-extension='+root],
});
try{
  let worker=browser.serviceWorkers()[0];
  if(!worker)worker=await browser.waitForEvent('serviceworker',{timeout:20000});
  const url='chrome-extension://'+new URL(worker.url()).host+'/popup.html';
  const page=await browser.newPage();
  await page.goto(url,{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#network-label')?.textContent==='Not configured');
  assert.equal(await page.locator('#quick-send').isDisabled(),true);
  assert.equal(await page.locator('#quick-receive').isDisabled(),true);
  assert.equal(await page.locator('#native-balance').textContent(),'—');
  await page.screenshot({path:resolve(screenshots,'01-unconfigured-wallet.png')});
  await page.locator('#header-settings').click();
  assert.equal(await page.locator('#settings-view').isVisible(),true);
  await page.screenshot({path:resolve(screenshots,'02-settings.png')});
  await page.evaluate(async({controller,factory,port})=>{
    await chrome.storage.local.set({
      '420-wallet-extension-config-v1':{
        rpcUrl:'http://127.0.0.1:'+port+'/',chainId:'0x1a4',networkName:'420 Integrated',
        accounts:[controller],smartAccountConfig:{factoryAddress:factory},trackedAssets:[]
      },
      '420-wallet-origin-permissions-v1':{
        'https://example.test':{accounts:[controller],grantedAt:Date.now()}
      }
    });
  },{controller,factory,port:rpc.address().port});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#native-balance')?.textContent!=='—',{timeout:15000});
  assert.equal(await page.locator('#quick-send').isDisabled(),false);
  assert.equal(await page.locator('#quick-receive').isDisabled(),false);
  assert.match(await page.locator('#account-address').textContent(),/0x333333/);
  await page.screenshot({path:resolve(screenshots,'03-verified-local-fixture-wallet.png')});
  await page.locator('#quick-receive').click();
  assert.equal(await page.locator('#receive-address').textContent(),account);
  await page.screenshot({path:resolve(screenshots,'04-receive-local-fixture.png')});
  await page.locator('[data-back]').last().click();
  await page.locator('#quick-send').click();
  await page.locator('#send-recipient').fill('0x4444444444444444444444444444444444444444');
  await page.locator('#send-amount').fill('1.25');
  await page.locator('#send-review-button').click();
  assert.equal(await page.locator('#send-review').isVisible(),true);
  await page.screenshot({path:resolve(screenshots,'05-send-review-local-fixture.png')});
  await page.locator('[data-screen="sites-view"]').click();
  assert.match(await page.locator('#site-list').textContent(),/example\.test/);
  await page.screenshot({path:resolve(screenshots,'06-connected-sites-local-fixture.png')});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Disconnect https://example.test'}).click();
  await page.waitForFunction(()=>document.querySelector('#site-list')?.textContent?.includes('No connected sites'));
  await page.locator('[data-screen="activity-view"]').click();
  await page.screenshot({path:resolve(screenshots,'07-activity-empty.png')});
  await page.evaluate(async({controller})=>{
    await chrome.storage.local.set({
      '420-wallet-pending-approvals-v1':{
        'visual-fixture':{
          request:{method:'eth_requestAccounts',availableAccounts:[controller]},
          context:{origin:'https://example.test'}
        }
      }
    });
  },{controller});
  await page.goto(url+'?approval=visual-fixture',{waitUntil:'load'});
  await page.locator('#approve').waitFor({state:'visible'});
  assert.match(await page.locator('#origin').textContent(),/example\.test/);
  await page.screenshot({path:resolve(screenshots,'08-approval-local-fixture.png')});
  console.log('PASS: eight actual extension popup screenshots; numbered 03–08 use a clearly synthetic local fixture; no transaction was submitted.');
}finally{
  await browser.close();
  await new Promise(resolve=>rpc.close(resolve));
}
