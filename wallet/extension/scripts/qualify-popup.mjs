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
  if(method==='eth_chainId')result=req.url==='/secondary'?'0x1':'0x1a4';
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
  const diagnostics=[];
  page.on('console',m=>diagnostics.push('console: '+m.type()+' '+m.text()));
  page.on('pageerror',e=>diagnostics.push('pageerror: '+e.message));
  worker.on('console',m=>diagnostics.push('worker: '+m.type()+' '+m.text()));
  worker.on('pageerror',e=>diagnostics.push('worker error: '+e.message));
  await page.goto(url,{waitUntil:'load'});
  console.log('extension boot bridge',JSON.stringify(await page.evaluate(async()=>{try{return await chrome.runtime.sendMessage({source:'420-wallet-popup-ui',kind:'get-state'});}catch(e){return {exception:String(e)};}})));
  console.log('extension boot DOM',JSON.stringify({label:await page.locator('#network-label').textContent(),notice:await page.locator('#dashboard-notice').textContent(),diagnostics}));
  await page.screenshot({path:resolve(screenshots,'00-startup.png')});
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
        accounts:[controller],vaultAccounts:[controller],accountMeta:{[controller]:{label:'Watch fixture',type:'watch-only',hidden:false}},
        smartAccountConfig:{factoryAddress:factory},trackedAssets:[]
      },
      '420-wallet-ui-preferences-v1':{selectedAccount:controller},
      '420-wallet-networks-v1':{version:1,epoch:1,selectedChainId:'0x1a4',networks:{
        '0x1a4':{chainId:'0x1a4',chainName:'420 Integrated',rpcUrls:['http://127.0.0.1:'+port+'/'],
          blockExplorerUrls:[],enabled:true,trusted:true,smartAccountApproved:false,
          nativeCurrency:{name:'420',symbol:'420',decimals:18}}
      }},
      '420-wallet-origin-permissions-v1':{
        'https://example.test':{accounts:[controller],chainId:'0x1a4',grantedAt:Date.now()}
      }
    });
  },{controller,factory,port:rpc.address().port});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#native-balance')?.textContent!=='—',{timeout:15000});
  assert.equal(await page.locator('#quick-send').isDisabled(),true,'Unverified SmartAccount cannot execute even with a factory address');
  assert.equal(await page.locator('#quick-receive').isDisabled(),false);
  assert.match(await page.locator('#account-address').textContent(),/0x11111/);
  await page.screenshot({path:resolve(screenshots,'03-verified-local-fixture-wallet.png')});
  await page.locator('#quick-receive').click();
  assert.equal(await page.locator('#receive-address').textContent(),controller);
  await page.screenshot({path:resolve(screenshots,'04-receive-local-fixture.png')});
  await page.locator('#receive-view [data-back]').click();
  // M3: watch-only and unverified SmartAccount cannot create an executable preview.
  assert.equal(await page.locator('#quick-send').isDisabled(),true);
  await page.locator('#header-settings').click();
  assert.equal(await page.locator('#network-select').inputValue(),'0x1a4');
  assert.match(await page.locator('#network-health').textContent(),/healthy RPC endpoints/);
  await page.locator('#new-chain-name').fill('Ethereum local fixture');
  await page.locator('#new-chain-id').fill('0x1');
  await page.locator('#new-rpc-urls').fill('http://127.0.0.1:'+rpc.address().port+'/secondary');
  await page.locator('#new-currency-name').fill('Ether');
  await page.locator('#new-currency-symbol').fill('ETH');
  await page.locator('#new-currency-decimals').fill('18');
  await page.locator('#add-network-form button[type=submit]').click();
  await page.waitForFunction(()=>[...document.querySelector('#network-select').options].some(o=>o.value==='0x1'));
  await page.locator('#network-select').selectOption('0x1');
  await page.locator('#switch-network').click();
  await page.waitForFunction(()=>document.querySelector('#network-select').value==='0x1'&&document.querySelector('#network-health').textContent.includes('0x1'));
  assert.equal(await page.locator('#quick-send').isDisabled(),true);
  await page.locator('[data-screen="dashboard"]').click();
  assert.equal(await page.locator('#native-symbol').textContent(),'ETH');
  const epochAfterSwitch=await page.evaluate(async()=>((await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1']).epoch);
  assert.ok(epochAfterSwitch>1,'chain switch advances context epoch');
  const replay=await page.evaluate(async controller=>{
    return await chrome.runtime.sendMessage({source:'420-wallet-popup-ui',kind:'send',confirmed:true,
      account:controller,chainId:'0x1a4',epoch:1,recipient:'0x4444444444444444444444444444444444444444',amount:'1',asset:'native'});
  },controller);
  assert.match(replay.error?.message||'',/Network or account changed since review/);
  await page.locator('#header-settings').click();
  await page.locator('#network-select').selectOption('0x1a4');
  await page.locator('#switch-network').click();
  await page.waitForFunction(()=>document.querySelector('#network-select').value==='0x1a4');
  assert.equal(await page.locator('#native-symbol').textContent(),'420');
  const epochReturned=await page.evaluate(async()=>((await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1']).epoch);
  assert.ok(epochReturned>epochAfterSwitch,'A→B→A cannot reuse old preview epoch');
  await page.locator('[data-screen="dashboard"]').click();
  await page.screenshot({path:resolve(screenshots,'05-multichain-local-fixture.png')});
  await page.locator('[data-screen="sites-view"]').click();
  assert.match(await page.locator('#site-list').textContent(),/example\.test/);
  assert.equal(await page.locator('.site-network-select').first().inputValue(),'0x1a4');
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
