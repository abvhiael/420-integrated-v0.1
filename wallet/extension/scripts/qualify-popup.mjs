import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import jsQR from 'jsqr';
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
const nft1155='0x7777777777777777777777777777777777777777';
const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const stringReturn=s=>{
  const hex=Buffer.from(s).toString('hex');
  return '0x'+word(32).slice(2)+word(hex.length/2).slice(2)+hex.padEnd(Math.ceil(hex.length/64)*64,'0');
};
const rpc=createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/dapp'){
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
    res.end('<!doctype html><html><head><title>420 Wallet dApp fixture</title></head><body><h1>Local dApp compatibility fixture</h1></body></html>');
    return;
  }
  // Chromium automatically probes favicon and may issue HEAD/OPTIONS requests.
  // Only POST carries JSON-RPC; never parse an empty non-RPC request as JSON.
  if(req.method!=='POST'){res.writeHead(204).end();return;}
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
    if((to===nft||to===nft1155)&&data.startsWith('0x01ffc9a7')){
      const iface=data.slice(10,18);
      result=word(iface==='01ffc9a7'||
        (to===nft&&iface==='80ac58cd')||(to===nft1155&&iface==='d9b67a26')?1:0);
    }
    else if(to===nft1155&&data.startsWith('0x00fdd58e'))result=word(3);
    else if(to===nft&&data.startsWith('0xc87b56dd'))result=stringReturn('https://metadata.example.test/42.json');
    else if(to===token&&data==='0x313ce567')result=word(6);
    else if(to===token&&data==='0x95d89b41')result=stringReturn('TEST');
    else if(to===token&&data.startsWith('0x70a08231'))result=word(12500000);
    else if(to===token&&data.startsWith('0xdd62ed3e'))result=word(1000000000);
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
  // Independent third-party decoder on pixels rendered by the actual extension popup.
  // The source text, copied address and decoded QR must agree exactly.
  const qrPixels=await page.locator('#receive-qr').evaluate(canvas=>{
    if(canvas.hidden)throw new Error('Receive QR is unexpectedly hidden');
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Receive canvas is unavailable');
    return {width:canvas.width,height:canvas.height,
      bytes:Array.from(context.getImageData(0,0,canvas.width,canvas.height).data)};
  });
  const qrResult=jsQR(Uint8ClampedArray.from(qrPixels.bytes),qrPixels.width,qrPixels.height,
    {inversionAttempts:'dontInvert'});
  assert.ok(qrResult,'Independent decoder must read actual rendered QR pixels');
  assert.equal(qrResult.data,controller,'Decoded QR must equal the verified receiving address');
  assert.match(await page.locator('#receive-qr-network').textContent(),/Address-only QR/);
  console.log('PASS: QR verified by independent jsQR decoder on real Chromium Receive canvas');
  await page.screenshot({path:resolve(screenshots,'04-receive-local-fixture.png')});
  await page.locator('#receive-view [data-back]').click();

  // M6: real content-script injection, EIP-6963 re-discovery, passive
  // EIP-1193 connection restoration, MetaMask coexistence and EIP-2255
  // same-origin grant/revocation in packaged Chromium. No signing is simulated.
  const dappOrigin='http://127.0.0.1:'+rpc.address().port;
  await page.evaluate(async({dappOrigin,controller})=>{
    const key='420-wallet-origin-permissions-v1';
    const grants=(await chrome.storage.local.get(key))?.[key]||{};
    grants[dappOrigin]={accounts:[controller],chainId:'0x1a4',grantedAt:Date.now()};
    await chrome.storage.local.set({[key]:grants});
  },{dappOrigin,controller});
  const dapp=await browser.newPage();
  await dapp.goto(dappOrigin+'/dapp',{waitUntil:'load'});
  const providerSnapshot=await dapp.evaluate(async()=>{
    let found=null;
    window.addEventListener('eip6963:announceProvider',event=>{
      if(event.detail?.info?.name==='420 Wallet')found=event.detail;
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    if(!found)throw new Error('EIP-6963 provider not discoverable in real page');
    window.__wallet420=found.provider;
    const accounts=await found.provider.request({method:'eth_accounts'});
    const chainId=await found.provider.request({method:'eth_chainId'});
    const permissions=await found.provider.request({method:'wallet_getPermissions'});
    const capabilities=await found.provider.request({method:'wallet_getCapabilities',params:[accounts[0]]});
    const requested=await found.provider.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]});
    return {accounts,chainId,permissions,capabilities,requested,
      name:found.info.name,icon:found.info.icon,connected:found.provider.isConnected()};
  });
  assert.deepEqual(providerSnapshot.accounts,[controller]);
  assert.equal(providerSnapshot.chainId,'0x1a4');
  assert.equal(providerSnapshot.permissions[0]?.parentCapability,'eth_accounts');
  assert.equal(providerSnapshot.requested[0]?.parentCapability,'eth_accounts');
  assert.equal(providerSnapshot.capabilities['0x1a4']?.atomicBatch?.supported,false,
    'Watch-only EOA cannot claim atomic SmartAccount execution');
  assert.equal(providerSnapshot.connected,true);
  assert.ok(providerSnapshot.icon.startsWith('data:image/svg+xml,'));
  const coexistence=await dapp.evaluate(()=>{
    const wallet=window.__wallet420;
    const metamask={isMetaMask:true};
    Object.defineProperty(window,'ethereum',{configurable:true,value:metamask});
    let discovered=null;
    window.addEventListener('eip6963:announceProvider',event=>{
      if(event.detail?.info?.name==='420 Wallet')discovered=event.detail.provider;
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return {metaMaskPreserved:window.ethereum===metamask,walletPreserved:discovered===wallet};
  });
  assert.equal(coexistence.metaMaskPreserved,true);
  assert.equal(coexistence.walletPreserved,true);
  await dapp.reload();
  const afterReload=await dapp.evaluate(async()=>{
    let wallet=null;
    window.addEventListener('eip6963:announceProvider',event=>{
      if(event.detail?.info?.name==='420 Wallet')wallet=event.detail.provider;
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    if(!wallet)throw new Error('Wallet disappeared after reload');
    window.__wallet420=wallet;window.__accountsEvents=[];
    wallet.on('accountsChanged',accounts=>window.__accountsEvents.push(accounts));
    return {accounts:await wallet.request({method:'eth_accounts'}),
      chainId:await wallet.request({method:'eth_chainId'})};
  });
  assert.deepEqual(afterReload.accounts,[controller]);
  assert.equal(afterReload.chainId,'0x1a4');
  await dapp.evaluate(async()=>window.__wallet420.request({
    method:'wallet_revokePermissions',params:[{eth_accounts:{}}]
  }));
  await dapp.waitForFunction(()=>window.__accountsEvents?.some(x=>Array.isArray(x)&&x.length===0));
  assert.deepEqual(await dapp.evaluate(async()=>window.__wallet420.request({method:'eth_accounts'})),[]);
  const denied=await dapp.evaluate(async()=>{
    try{await window.__wallet420.request({method:'wallet_sendCalls',params:[]});return false;}
    catch(error){return error.code===4100;}
  });
  assert.equal(denied,true,'Revoked site must not submit contract batch');
  await dapp.close();
  console.log('PASS: real Chromium EIP-6963, coexistence, account restoration, EIP-2255 permission and revocation');

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
  assert.match(replay.error?.message||'',/Network or account changed since review/);
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
  assert.match(await page.locator('#nft-list').textContent(),/Owner|verified on chain/i);
  await page.screenshot({path:resolve(screenshots,'11-portfolio-nft-verified.png')});
  // M8: actual packaged NFT detail, collection grouping, local spam,
  // safe metadata opt-in boundary and fail-closed watch-only signing.
  await page.locator('#nft-list .nft-item').first().click();
  assert.equal(await page.locator('#nft-detail-view').isVisible(),true);
  assert.match(await page.locator('#nft-detail-facts').textContent(),/ownerOf\(tokenId\)/);
  assert.match(await page.locator('#nft-detail-metadata').textContent(),/Not loaded/);
  assert.equal(await page.locator('#nft-review').isHidden(),true);
  await page.locator('#nft-recipient').fill('0x'+'77'.repeat(20));
  await page.locator('#nft-action-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#nft-detail-status')?.textContent?.includes('NFT review blocked'));
  assert.match(await page.locator('#nft-detail-status').textContent(),/Unlock qualified local EOA or passkey authority/);
  assert.equal(await page.locator('#nft-review').isHidden(),true);
  await page.locator('#nft-spam').click();
  await page.waitForFunction(()=>document.querySelector('#nft-spam')?.textContent==='Unmark spam');
  await page.locator('#nft-detail-view [data-back]').click();
  assert.equal(await page.locator('#nfts-view').isVisible(),true);
  assert.equal(await page.locator('#nft-list .nft-item').count(),0,'Flagged spam collectible hidden from the default collection view');
  await page.locator('#nfts-show-hidden').click();
  await page.waitForFunction(()=>document.querySelectorAll('#nft-list .nft-item').length===1);
  assert.match(await page.locator('#nft-list').textContent(),/Potential spam/);
  await page.screenshot({path:resolve(screenshots,'11a-nft-collection-and-spam.png')});
  await page.locator('#nft-list .nft-item').first().click();
  await page.locator('#nft-spam').click();
  await page.waitForFunction(()=>document.querySelector('#nft-spam')?.textContent==='Mark as spam');
  await page.locator('#nft-detail-view [data-back]').click();
  // M8: Manual import of older game collectibles not seen in recent logs;
  // ERC-1155 balanceOf must prove current ownership before display.
  await page.locator('#nft-import-standard').selectOption('ERC1155');
  await page.locator('#nft-import-contract').fill(nft1155);
  await page.locator('#nft-import-id').fill('7');
  await page.locator('#nft-import-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#nft-list')?.textContent?.includes('ERC1155 #7'));
  assert.match(await page.locator('#nft-list').textContent(),/quantity 3/);
  await page.locator('#nft-list .nft-item').filter({hasText:'ERC1155 #7'}).click();
  assert.match(await page.locator('#nft-detail-facts').textContent(),/balanceOf\(owner,tokenId\)/);
  await page.locator('#nft-recipient').fill('0x'+'33'.repeat(20));
  await page.locator('#nft-inspect-approval').click();
  await page.waitForFunction(()=>document.querySelector('#nft-approval-status')?.textContent?.includes('not approved')||
    document.querySelector('#nft-approval-status')?.textContent?.includes('approved for ALL'));
  await page.locator('#nft-detail-view [data-back]').click();
  await page.locator('[data-screen="dashboard"]').click();
  await page.locator('[data-screen="sites-view"]').click();
  assert.match(await page.locator('#site-list').textContent(),/example\.test/);
  // M7: actual packaged Security Centre reads a live mock-chain allowance;
  // a watch-only account cannot submit an on-chain revoke transaction.
  await page.locator('#open-security-centre').click();
  assert.equal(await page.locator('#security-view').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#security-sites')?.textContent?.includes('example.test'));
  assert.match(await page.locator('#security-sites').textContent(),/Disconnected|Disconnect website only/);
  assert.match(await page.locator('#security-view').textContent(),/does not change|does not revoke|not an on-chain revocation/i);
  await page.locator('#security-token').fill(token);
  await page.locator('#security-spender').fill('0x'+'77'.repeat(20));
  await page.locator('#security-allowance-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#security-allowances')?.textContent?.includes('1000000000'));
  assert.match(await page.locator('#security-allowances').textContent(),/active/);
  assert.equal(await page.locator('#security-capabilities').isVisible(),true);
  assert.equal(await page.locator('#security-passkeys').isVisible(),true);
  assert.equal(await page.locator('#security-recovery').isVisible(),true);
  await page.screenshot({path:resolve(screenshots,'09-security-centre-verified-allowance.png')});
  await page.getByRole('button',{name:'Review on-chain allowance revocation'}).click();
  await page.waitForFunction(()=>document.querySelector('#security-status')?.textContent?.includes('Revocation cannot proceed'));
  assert.match(await page.locator('#security-status').textContent(),/Unlock verified local signing authority/);
  assert.equal(await page.locator('#security-revocation-review').isHidden(),true,
    'Watch-only account cannot prepare or authorize an on-chain revoke');
  await page.locator('#security-view [data-back]').click();
  assert.equal(await page.locator('#sites-view').isVisible(),true);

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
  // M6: preserve origin-scoped grants and selected network through a genuine
  // Chromium process/extension-worker restart, not merely a page reload.
  const restartProfile=mkdtempSync(join(tmpdir(),'wallet420-m6-profile-'));
  const browserOptions={channel:'chromium',headless:true,viewport:{width:410,height:640},
    args:['--disable-extensions-except='+root,'--load-extension='+root]};
  let firstContext=null,rebootContext=null;
  try{
    firstContext=await chromium.launchPersistentContext(restartProfile,browserOptions);
    let firstWorker=firstContext.serviceWorkers()[0];
    if(!firstWorker)firstWorker=await firstContext.waitForEvent('serviceworker',{timeout:20000});
    const extensionUrl='chrome-extension://'+new URL(firstWorker.url()).host+'/popup.html';
    const setup=await firstContext.newPage();
    await setup.goto(extensionUrl,{waitUntil:'load'});
    // The extension's first-run registry initialization is asynchronous.
    // Wait for the real service worker's default-registry transaction before
    // writing the persisted restart fixture, or its first-run write may race
    // and overwrite the saved chain identity during a cold profile startup.
    await setup.waitForFunction(async()=>{
      const response=await chrome.runtime.sendMessage({
        source:'420-wallet-popup-ui',kind:'get-state'
      });
      return !response?.error&&Boolean(response?.result?.registry?.networks);
    },undefined,{timeout:20000});
    await setup.evaluate(async({controller,port,dappOrigin})=>{
      await chrome.storage.local.set({
        '420-wallet-extension-config-v1':{
          rpcUrl:'http://127.0.0.1:'+port+'/',chainId:'0x1a4',networkName:'420 Integrated',
          accounts:[controller],accountMeta:{[controller]:{label:'Restart fixture',type:'watch-only'}},
          trackedAssets:[],smartAccountConfig:null
        },
        '420-wallet-ui-preferences-v1':{selectedAccount:controller},
        '420-wallet-networks-v1':{version:1,epoch:1,selectedChainId:'0x1a4',networks:{
          '0x1a4':{chainId:'0x1a4',chainName:'420 Integrated',
            rpcUrls:['http://127.0.0.1:'+port+'/'],blockExplorerUrls:[],
            enabled:true,trusted:true,smartAccountApproved:false,
            nativeCurrency:{name:'420',symbol:'420',decimals:18}}
        }},
        '420-wallet-origin-permissions-v1':{
          [dappOrigin]:{accounts:[controller],chainId:'0x1a4',grantedAt:Date.now()}
        }
      });
      const registry=(await chrome.storage.local.get('420-wallet-networks-v1'))['420-wallet-networks-v1'];
      if(registry?.selectedChainId!=='0x1a4'||registry?.networks?.['0x1a4']?.enabled!==true)
        throw new Error('Restart fixture network was not durably configured');
    },{controller,port:rpc.address().port,dappOrigin});
    await firstContext.close();
    firstContext=null;
    rebootContext=await chromium.launchPersistentContext(restartProfile,browserOptions);
    const restored=await rebootContext.newPage();
    await restored.goto(dappOrigin+'/dapp',{waitUntil:'load'});
    const recovered=await restored.evaluate(async()=>{
      let provider=null;
      window.addEventListener('eip6963:announceProvider',event=>{
        if(event.detail?.info?.name==='420 Wallet')provider=event.detail.provider;
      });
      window.dispatchEvent(new Event('eip6963:requestProvider'));
      if(!provider)throw new Error('Provider missing after browser restart');
      return {
        accounts:await provider.request({method:'eth_accounts'}),
        chainId:await provider.request({method:'eth_chainId'}),
        permissions:await provider.request({method:'wallet_getPermissions'})
      };
    });
    assert.deepEqual(recovered.accounts,[controller]);
    assert.equal(recovered.chainId,'0x1a4');
    assert.equal(recovered.permissions[0]?.parentCapability,'eth_accounts');
    console.log('PASS: Chromium restart preserves origin grants, chain identity and wallet discovery');
  }finally{
    if(firstContext)await firstContext.close();
    if(rebootContext)await rebootContext.close();
    rmSync(restartProfile,{recursive:true,force:true});
  }
  console.log('PASS: packaged extension popup and M4 account-scoped Tokens/NFTs/asset-details with real mock-chain RPC; no signing or transaction submitted.');
}finally{
  await browser.close();
  await new Promise(resolve=>rpc.close(resolve));
}
