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
const token='0x5555555555555555555555555555555555555555';
const nft='0x6666666666666666666666666666666666666666';
const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const stringReturn=s=>{
  const hex=Buffer.from(s).toString('hex');
  return '0x'+word(32).slice(2)+word(hex.length/2).slice(2)+hex.padEnd(Math.ceil(hex.length/64)*64,'0');
};
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
  else if(method==='eth_getLogs'){
    const topics=body.params?.[0]?.topics||[];
    result=topics[1]===null?[
      {address:token,topics:[transfer,addressWord('0x'+'0'.repeat(40)),addressWord(controller)]},
      {address:nft,topics:[transfer,addressWord('0x'+'0'.repeat(40)),addressWord(controller),word(42)]}
    ]:[];
  }
  else if(method==='eth_call'){
    const to=body.params?.[0]?.to?.toLowerCase(),data=body.params?.[0]?.data?.toLowerCase()||'';
    if(to===token&&data==='0x313ce567')result=word(6);
    else if(to===token&&data==='0x95d89b41')result=stringReturn('TEST');
    else if(to===token&&data.startsWith('0x70a08231'))result=word(12500000);
    else if(to===nft&&data.startsWith('0x6352211e'))result=addressWord(controller);
    else result=to===factory?addressWord(account):addressWord(controller);
  }
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
  assert.equal(await page.locator('#receive-qr').locator('canvas, img').count()>0,true,
    'Receive QR must render locally without a third-party request');
  await page.screenshot({path:resolve(screenshots,'04-receive-local-fixture.png')});
  await page.locator('#receive-view [data-back]').click();
  // M5: watch-only remains unable to execute the new preflight transaction workflow.
  const blocked=await page.evaluate(async controller=>chrome.runtime.sendMessage({
    source:'420-wallet-popup-ui',kind:'prepare-send',recipient:controller,amount:'1',asset:'native'
  }),controller);
  assert.match(blocked.error?.message||'',/No verified local signing authority/);
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
  await page.waitForFunction(async()=>{
    const active=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
    return active?.selectedChainId==='0x1'&&document.querySelector('#native-symbol')?.textContent==='ETH';
  });
  assert.equal(await page.locator('#quick-send').isDisabled(),true);
  await page.locator('[data-screen="dashboard"]').click();
  await page.waitForFunction(async()=>{
    const registry=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
    return registry?.selectedChainId==='0x1'&&document.querySelector('#native-symbol')?.textContent==='ETH';
  },undefined,{timeout:15000});
  assert.equal(await page.locator('#native-symbol').textContent(),'ETH');
  const epochAfterSwitch=await page.evaluate(async()=>((await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1']).epoch);
  assert.ok(epochAfterSwitch>1,'chain switch advances context epoch');
  const replay=await page.evaluate(async controller=>{
    return await chrome.runtime.sendMessage({source:'420-wallet-popup-ui',kind:'send',confirmed:true,
      account:controller,chainId:'0x1a4',epoch:1,recipient:'0x4444444444444444444444444444444444444444',amount:'1',asset:'native'});
  },controller);
  assert.match(replay.error?.message||'',/Stale chain or account transaction preview|Network or account changed since review/);
  await page.locator('#header-settings').click();
  await page.locator('#network-select').selectOption('0x1a4');
  await page.locator('#switch-network').click();
  await page.waitForFunction(async()=>{
    const active=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
    return active?.selectedChainId==='0x1a4'&&document.querySelector('#native-symbol')?.textContent==='420';
  });
  console.log('network roundtrip display',JSON.stringify(await page.evaluate(async()=>{
    const reg=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
    const bridge=await chrome.runtime.sendMessage({source:'420-wallet-popup-ui',kind:'get-state'});
    return {epoch:reg?.epoch,selectedChainId:reg?.selectedChainId,
      currency:bridge?.result?.config?.nativeCurrency?.symbol,
      observed:document.querySelector('#native-symbol')?.textContent};
  })));
  assert.equal(await page.locator('#native-symbol').textContent(),'420');
  const epochReturned=await page.evaluate(async()=>((await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1']).epoch);
  assert.ok(epochReturned>epochAfterSwitch,'A→B→A cannot reuse old preview epoch');
  await page.locator('[data-screen="dashboard"]').click();
  await page.screenshot({path:resolve(screenshots,'05-multichain-local-fixture.png')});
  // W15.6-M4: actual Chromium portfolio, contract-backed import, hide/unhide, discovery and NFT ownership.
  await page.waitForFunction(()=>document.querySelector('#portfolio-status')?.textContent.includes('Block'));
  assert.match(await page.locator('#portfolio-fiat').textContent(),/Fiat total unavailable/);
  assert.equal(await page.locator('#quick-send').isDisabled(),true,'Watch-only portfolio remains non-signing');
  await page.locator('#header-settings').click();
  await page.locator('#token-address').fill(token);
  await page.locator('#token-import-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#asset-list')?.textContent.includes('TEST'));
  await page.screenshot({path:resolve(screenshots,'09-portfolio-tokens.png')});
  await page.getByRole('button',{name:'View TEST asset details'}).click();
  assert.match(await page.locator('#asset-detail').textContent(),/Verified on-chain/);
  await page.screenshot({path:resolve(screenshots,'10-portfolio-asset-detail.png')});
  await page.locator('#asset-hide').click();
  await page.waitForFunction(()=>!document.querySelector('#asset-list')?.textContent.includes('TEST'));
  await page.locator('#show-hidden-assets').click();
  await page.waitForFunction(()=>document.querySelector('#asset-list')?.textContent.includes('TEST'));
  await page.locator('#discover-assets').click();
  await page.waitForFunction(()=>document.querySelector('#dashboard-notice')?.textContent.includes('ERC-721'));
  await page.locator('#tab-nfts').click();
  await page.waitForFunction(()=>document.querySelector('#nft-list')?.textContent.includes('ERC721 #42'));
  await page.screenshot({path:resolve(screenshots,'11-portfolio-nft-verified.png')});
  await page.locator('[data-screen="dashboard"]').click();
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
  console.log('PASS: packaged extension popup and M4 account-scoped Tokens/NFTs/asset-details with real mock-chain RPC; no signing or transaction submitted.');
}finally{
  await browser.close();
  await new Promise(resolve=>rpc.close(resolve));
}
