import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(new URL('../dist/',import.meta.url).pathname);
const sha=process.env.GITHUB_SHA||process.env.EXCHANGE_BUILD_SHA||'unidentified';
const report={schema:'420-exchange-pre03-browser-acceptance-v1',testedCommit:sha,browser:null,preview:'qualification-mode generated dist with intercepted qualification-only runtime/quote transport; not live testnet evidence',cases:[],realWalletEvidence:false,liveTransactionEvidence:false};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const server=createServer((req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(pathname==='/'||!extname(pathname))pathname='/index.html';const file=resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+sep))throw Error('invalid path');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;

const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),tokenIn=address(3),tokenOut=address(4),router=address(100);
const assetIn=id(100),assetOut=id(101),marketId=id(10),routeId=id(11),quoteId=id(99),pathHash=id(900);
const runtime={
 schema:'420-exchange-web-runtime-v14.1',
 site:{name:'420Exchange',productionOrigin:'https://exchange.420integrated.org'},
 network:{name:'420 Integrated Qualification',chainId:'0x1a4',rpcUrl:'https://rpc.example.invalid',explorerUrl:'https://explorer.example.invalid'},
 api:{baseUrl:'https://api.example.invalid/exchange',executableQuoteUrl:'https://api.example.invalid/exchange/executable-swap-quote',streamUrl:'wss://api.example.invalid/exchange/stream',transport:'websocket-or-sse',schemaMajor:14,schemaMinor:0,marketSubjects:[]},
 deployment:{status:'RESOLVED',environment:'testnet'},
 contracts:{ExchangeAtomicRouter420:router},
 reviewCatalogue:{schema:'420-exchange-review-catalogue-v1',qualification:'QUALIFIED_CONFIG',authority:'METADATA_ONLY',demo:false,fixture:false,chainId:'0x1a4',maxRouteHops:2,
  assets:[
   {assetId:assetIn,address:tokenIn,symbol:'BOB',name:'Bob Token',decimals:18,verified:true,reviewEligible:true},
   {assetId:assetOut,address:tokenOut,symbol:'ARRR',name:'Arrr Token',decimals:6,verified:true,reviewEligible:true},
  ],
  markets:[{marketId,inputAssetId:assetIn,outputAssetId:assetOut,label:'BOB → ARRR',active:true,reviewEligible:true}],
 },
 features:{markets:true,marketDetail:true,swap:true,limitOrders:true,bridge:true,portfolio:true,walletConnection:true},
};

let browser;
async function fixture(page){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(origin+'/runtime-config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(runtime)}));
 await page.route(runtime.api.executableQuoteUrl,async route=>{
  const body=route.request().postDataJSON();
  const now=Math.floor(Date.now()/1000);
  assert.equal(body.account,account);assert.equal(body.tokenIn,tokenIn);assert.equal(body.tokenOut,tokenOut);
  assert.equal(body.amountInRaw,'1250000000000000000');assert.equal(body.minimumOutputRaw,'4100000');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   schema:'420-exchange-executable-swap-quote-v1',marketSource:'api',demo:false,fixture:false,quoteId,chainId:'0x1a4',account,
   observedAt:now,expiresAt:now+60,
   reviewedIntent:{kind:'EXACT_INPUT_PATH',recipient,routeCommitment:pathHash,hops:[{marketId,outputToken:tokenOut}]},
   execution:{mode:'ERC20_TO_ERC20',tokenIn,recipient,amountInRaw:body.amountInRaw,minFinalAmountOutRaw:'4200000',expectedPathHash:pathHash,hops:[{marketId,routeId,tokenOut,minAmountOutRaw:'4200000',routeData:'0x'}]},
   tokens:{input:{address:tokenIn,decimals:18,symbol:'BOB',verified:true},output:{address:tokenOut,decimals:6,symbol:'ARRR',verified:true}},
   fees:{outputToken:tokenOut,totalFeeRaw:'10000',rateBps:25,components:[{label:'exchange protocol',amountRaw:'10000'}]},
  })});
 });
 await page.addInitScript(({account})=>{
  const events=new Map();
  const provider={calls:[],request({method}){this.calls.push(method);if(method==='eth_requestAccounts'||method==='eth_accounts')return Promise.resolve([account]);if(method==='eth_chainId')return Promise.resolve('0x1a4');throw Error('unexpected provider request: '+method);},on(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeListener(type,fn){events.get(type)?.delete(fn);}};
  window.__pre03={provider};Object.defineProperty(window,'ethereum',{configurable:true,value:provider});
 },{account});
 await page.goto(origin+'/');
 await page.locator('#v15-wallet-provider option').nth(1).waitFor({state:'attached'});
 await page.locator('#market-rows tr').first().waitFor();
 assert.deepEqual(errors,[],'preview boot must have no uncaught browser exception');
}
async function connectAndOpenSwap(page){
 await page.locator('#connect').click();
 await page.getByText(/Connected 0x0000/i).first().waitFor();
 await page.locator('[data-route="/swap"]').first().click();
 await page.locator('#v15-quote-review').waitFor();
 await page.locator('#v15-review-market').selectOption(marketId);
 await page.locator('#v15-review-amount').fill('1.25');
 await page.locator('#v15-review-minimum').fill('4.1');
 await page.locator('#v15-review-recipient').fill(recipient);
}
async function run(name,fn,{viewport}={}){
 const page=await browser.newPage(viewport?{viewport}:undefined);
 try{await fixture(page);await fn(page);report.cases.push({name,result:'PASS'});console.log('PASS '+name);}
 catch(error){report.cases.push({name,result:'FAIL',detail:String(error.stack||error)});console.error('FAIL '+name,error);process.exitCode=1;}
 finally{await page.close();}
}

try{
 browser=await chromium.launch({headless:true});report.browser=`Chromium ${browser.version()} (GitHub Actions Linux, Playwright)`;

 await run('metadata-only market entry derives exact raw units and has keyboard-native form order',async page=>{
  await connectAndOpenSwap(page);
  await page.getByText(/1250000000000000000 raw BOB/).waitFor();
  await page.locator('#v15-review-market').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'v15-review-amount');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'v15-review-minimum');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'v15-review-recipient');
 });

 await run('candidate review exposes canonical fields, fees and complete untruncated identifiers',async page=>{
  await connectAndOpenSwap(page);
  await page.locator('#v15-quote-review-fetch').click();
  const result=page.locator('#v15-quote-review-result');await result.waitFor({state:'visible'});
  const text=await result.innerText();
  for(const exact of ['REVIEW CANDIDATE ONLY','1.25 BOB','1250000000000000000 raw','4.2 ARRR','4200000 raw','0.01 ARRR','25 bps',recipient,tokenIn,tokenOut,router,quoteId,pathHash,routeId])assert.ok(text.includes(exact),exact);
  assert.match(text,/producer authenticity not established/i);
  assert.match(text,/signing and transaction submission remain disabled/i);
  assert.equal(await page.evaluate(()=>[...window.__pre03.provider.calls].some(x=>/eth_sendTransaction|eth_signTypedData/.test(x))),false);
 });

 await run('malformed precision and changed input clear stale review without execution',async page=>{
  await connectAndOpenSwap(page);
  await page.locator('#v15-quote-review-fetch').click();await page.locator('#v15-quote-review-result').waitFor({state:'visible'});
  await page.locator('#v15-review-amount').fill('1.0000000000000000001');
  assert.equal(await page.locator('#v15-quote-review-result').isHidden(),true);
  await page.locator('#v15-quote-review-fetch').click();
  await page.getByText(/precision|decimal/i).waitFor();
  assert.equal(await page.evaluate(()=>[...window.__pre03.provider.calls].includes('eth_sendTransaction')),false);
 });

 await run('narrow-screen review stacks fields and preserves inspectable route details',async page=>{
  await connectAndOpenSwap(page);
  await page.locator('#v15-quote-review-fetch').click();await page.locator('#v15-quote-review-result').waitFor({state:'visible'});
  const columns=await page.locator('.pre03-review-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
  assert.equal(columns,1);
  const details=page.locator('.pre03-route-details');await details.locator('summary').click();
  assert.ok((await details.innerText()).includes(routeId));
 },{viewport:{width:480,height:900}});
}finally{
 await browser?.close();await new Promise(done=>server.close(done));
 mkdirSync(resolve(root,'../acceptance-evidence'),{recursive:true});
 const path=resolve(root,'../acceptance-evidence/pre03-chromium.json');writeFileSync(path,JSON.stringify(report,null,2)+'\n');
 console.log('PRE-03 browser evidence: '+path);console.log(JSON.stringify(report));
}
