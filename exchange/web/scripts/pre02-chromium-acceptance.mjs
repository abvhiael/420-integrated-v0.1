import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve, sep, extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(new URL('../dist/',import.meta.url).pathname);
const sha=process.env.GITHUB_SHA||process.env.EXCHANGE_BUILD_SHA||'unidentified';
const report={schema:'420-exchange-pre02-browser-acceptance-v1',testedCommit:sha,browser:null,wallet:'SIMULATED EIP-1193 injected providers; no real extension, hardware wallet or transaction',preview:'qualification-mode generated dist served over local HTTP; not a deployed Cloudflare preview',cases:[],realWalletEvidence:false,liveTransactionEvidence:false};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname==='/'||!extname(pathname))pathname='/index.html';
    const file=resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+sep))throw Error('invalid path');
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(readFileSync(file));
  }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
const accountA='0x1111111111111111111111111111111111111111';
const accountB='0x2222222222222222222222222222222222222222';
async function fixture(page){
  await page.addInitScript(({accountA,accountB})=>{
    const create=(name,account)=>{
      const events=new Map();let deferred=null;let chain='0x1a4';let currentAccount=account;
      return {name,calls:[],request({method}){
        this.calls.push(method);
        if(method==='eth_requestAccounts')return deferred?new Promise(resolve=>{deferred=resolve;}):Promise.resolve([currentAccount]);
        if(method==='eth_accounts')return Promise.resolve([currentAccount]);
        if(method==='eth_chainId')return Promise.resolve(chain);
        if(method==='wallet_switchEthereumChain'){throw Error('unexpected V14 chain switch');}
        if(method==='eth_sendTransaction'||method.startsWith('eth_sign')||method.startsWith('personal_sign'))throw Error('unexpected signing/submission');
        throw Error('unexpected provider request: '+method);
      },on(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeListener(type,fn){events.get(type)?.delete(fn);},emit(type,data){for(const fn of events.get(type)||[])fn(data);},setAccount(next){currentAccount=next;this.emit('accountsChanged',[next]);},setChain(next){chain=next;this.emit('chainChanged',next);},delayNextConnect(){deferred=true;},resolveConnect(){if(typeof deferred==='function'){const resolve=deferred;deferred=null;resolve([currentAccount]);}},listenerCount(){return [...events.values()].reduce((n,set)=>n+set.size,0)} };
    };
    const first=create('mock-one',accountA),second=create('mock-two',accountB);
    window.__pre02={first,second,accountA,accountB};
    Object.defineProperty(window,'ethereum',{configurable:true,value:{providers:[first,second]}});
  },{accountA,accountB});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(origin+'/');
  await page.locator('#v15-wallet-provider option').nth(2).waitFor();
  await page.locator('#market-rows tr').first().waitFor();
  assert.equal(errors.length,0,'preview boot must have no uncaught browser exception: '+errors.join('; '));
  return errors;
}
async function clickUnqualified(page){
  for(const route of ['/swap','/orders','/bridge']){
    await page.locator(`[data-route="${route}"]`).first().click();
    const selectors=route==='/swap'?['#swap-submit']:route==='/orders'?['#order-sign','[data-cancel-order]']:['#bridge-submit'];
    for(const selector of selectors){const items=page.locator(selector);await items.first().waitFor();assert.equal(await items.first().isDisabled(),true,route+' '+selector+' must be disabled');
      await items.first().evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
      assert.equal(await items.first().isDisabled(),true,route+' '+selector+' must stay disabled after synthetic click');
    }
  }
  const calls=await page.evaluate(()=>[...window.__pre02.first.calls,...window.__pre02.second.calls]);
  assert.equal(calls.filter(x=>/^(eth_sendTransaction|eth_sign|personal_sign|wallet_switchEthereumChain)/.test(x)).length,0,'V14 must never sign, submit or switch chain');
}
async function run(name,fn){const page=await browser.newPage();try{await fixture(page);await fn(page);report.cases.push({name,result:'PASS'});console.log('PASS '+name);}catch(error){report.cases.push({name,result:'FAIL',detail:String(error.stack||error)});console.error('FAIL '+name,error);process.exitCode=1;}finally{await page.close();}}
try{
  browser=await chromium.launch({headless:true});report.browser=`Chromium ${browser.version()} (GitHub Actions Linux, Playwright)`;
  await run('explicit provider selection; one V15 connect and no competing V14 request',async page=>{
    assert.equal(await page.locator('#v15-wallet-provider option').count(),3);
    assert.equal(await page.locator('#v15-wallet-provider').inputValue(),'');
    assert.equal(await page.evaluate(()=>window.__pre02.first.calls.length+window.__pre02.second.calls.length),0);
    await page.locator('#v15-wallet-provider').selectOption('legacy:0');await page.locator('#connect').click();
    await page.getByText(/Connected 0x1111/i).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__pre02.first.calls.filter(x=>x==='eth_requestAccounts').length),1);
    assert.equal(await page.evaluate(()=>window.__pre02.second.calls.length),0);
    await clickUnqualified(page);
  });
  await run('provider selection change invalidates old wallet and connects only selected provider',async page=>{
    await page.locator('#v15-wallet-provider').selectOption('legacy:0');await page.locator('#connect').click();await page.getByText(/Connected 0x1111/i).first().waitFor();
    await page.locator('#v15-wallet-provider').selectOption('legacy:1');await page.getByText(/provider changed/i).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__pre02.first.listenerCount()),0,'old provider listeners removed');
    await page.locator('#connect').click();await page.getByText(/Connected 0x2222/i).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__pre02.first.calls.filter(x=>x==='eth_requestAccounts').length),1);
    assert.equal(await page.evaluate(()=>window.__pre02.second.calls.filter(x=>x==='eth_requestAccounts').length),1);
    await clickUnqualified(page);
  });
  await run('delayed old provider response cannot restore a superseded wallet',async page=>{
    await page.locator('#v15-wallet-provider').selectOption('legacy:0');await page.evaluate(()=>window.__pre02.first.delayNextConnect());await page.locator('#connect').click();
    await page.getByText(/Requesting wallet connection/i).first().waitFor();
    await page.locator('#v15-wallet-provider').selectOption('legacy:1');
    await page.evaluate(()=>window.__pre02.first.resolveConnect());
    await page.getByText(/superseded|disposed|changed during connection/i).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__pre02.first.listenerCount()),0);
    assert.equal(await page.locator('#v15-wallet-message').innerText().then(x=>/Connected 0x1111/i.test(x)),false);
    await page.locator('#connect').click();await page.getByText(/Connected 0x2222/i).first().waitFor();await clickUnqualified(page);
  });
  await run('account and chain changes invalidate V15 session and review',async page=>{
    await page.locator('#v15-wallet-provider').selectOption('legacy:0');await page.locator('#connect').click();await page.getByText(/Connected 0x1111/i).first().waitFor();
    await page.evaluate(({accountB})=>window.__pre02.first.setAccount(accountB),{accountB});
    await page.getByText(/Wallet changed: accountsChanged/i).first().waitFor();
    await page.evaluate(()=>window.__pre02.first.setChain('0x1'));
    await page.getByText(/Wallet changed: chainChanged/i).first().waitFor();
    await clickUnqualified(page);
  });
  await run('navigation and quote input edits invalidate read-only review; no execution path',async page=>{
    await page.locator('[data-route="/swap"]').first().click();await page.locator('#v15-quote-review').waitFor();
    assert.equal(await page.locator('#v15-quote-review-fetch').isDisabled(),true,'quote endpoint is unconfigured in qualification preview');
    await page.locator('#v15-quote-review-result').evaluate(node=>{node.textContent='INJECTED STALE DISPLAY ONLY';node.hidden=false;});
    await page.locator('#v15-quote-review input').first().fill('0x3333333333333333333333333333333333333333');
    assert.equal(await page.locator('#v15-quote-review-result').isHidden(),true,'editing input must clear display');
    await page.locator('#v15-quote-review-result').evaluate(node=>{node.textContent='INJECTED STALE DISPLAY ONLY';node.hidden=false;});
    await page.locator('[data-route="/orders"]').first().click();await page.locator('#order-sign').waitFor();
    assert.equal(await page.locator('#v15-quote-review').count(),0,'review panel removed on navigation');
    await clickUnqualified(page);
  });
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  mkdirSync(resolve(root,'../acceptance-evidence'),{recursive:true});
  const path=resolve(root,'../acceptance-evidence/pre02-chromium.json');writeFileSync(path,JSON.stringify(report,null,2)+'\n');
  console.log('PRE-02 browser evidence: '+path);console.log(JSON.stringify(report));
}
