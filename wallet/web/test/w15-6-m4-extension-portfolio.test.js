import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {portfolioScope420,checkedToken420,spamSignals420,classifyBalance420,verifiedTokenMetadata420,
  checkedTokenBalance420,discoverTokens420,validatePrice420,fiatValue420,normalizedPortfolioSettings420,
  TRANSFER_TOPIC_420} from '../core/extension-portfolio.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../extension');
const source=path=>readFileSync(resolve(root,path),'utf8');
const address='0x1111111111111111111111111111111111111111';
const token='0x2222222222222222222222222222222222222222';
const nft='0x3333333333333333333333333333333333333333';
const word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const topic=a=>'0x'+a.slice(2).padStart(64,'0');
const stringReturn=s=>{const hex=Buffer.from(s).toString('hex');return '0x'+(32).toString(16).padStart(64,'0')+
  (hex.length/2).toString(16).padStart(64,'0')+hex.padEnd(Math.ceil(hex.length/64)*64,'0');};
function fakeProvider({wrongOwner=false,unavailable=false}={}){
 const seen=[];
 const provider={request:async(method,params=[])=>{
  seen.push({method,params});
  if(unavailable)throw new Error('provider outage');
  if(method==='eth_getCode')return '0x6001600055';
  if(method==='eth_blockNumber')return '0x40';
  if(method==='eth_getLogs'){
   const filter=params[0];
   if(filter.topics[1]===null)return [
    {address:token,topics:[TRANSFER_TOPIC_420,topic('0x'+'0'.repeat(40)),topic(address)]},
    {address:nft,topics:[TRANSFER_TOPIC_420,topic('0x'+'0'.repeat(40)),topic(address),word(42)]}
   ];
   return [];
  }
  if(method==='eth_call'){
   const data=params[0].data.toLowerCase(),to=params[0].to.toLowerCase();
   if(data==='0x313ce567')return word(6);
   if(data==='0x95d89b41')return stringReturn('TKN');
   if(data.startsWith('0x70a08231'))return word(12500000);
   if(data.startsWith('0x6352211e'))return topic(wrongOwner?'0x'+'4'.repeat(40):address);
   throw new Error('unexpected calldata '+data);
  }
  throw new Error('unsupported '+method);
 }};
 return {provider,seen};
}
test('M4: wallet assets scoped to exact account and EIP-155 chain',()=>{
 assert.equal(portfolioScope420('0x01',address),'0x1:'+address);
 assert.notEqual(portfolioScope420('0x2',address),portfolioScope420('0x1',address));
 assert.notEqual(portfolioScope420('0x1','0x'+'3'.repeat(40)),portfolioScope420('0x1',address));
 assert.throws(()=>portfolioScope420('garbage',address),/chain/);
});
test('M4: contract verified ERC20 metadata overrides user supplied hints and code absence fails closed',async()=>{
 const {provider,seen}=fakeProvider();
 const metadata=await verifiedTokenMetadata420(provider,token);
 assert.deepEqual(metadata,{address:token,symbol:'TKN',decimals:6,verified:true});
 assert.equal(await checkedTokenBalance420(provider,{...metadata,symbol:'FAKE'},address),'12500000');
 assert.ok(seen.some(x=>x.method==='eth_getCode'));
 assert.ok(seen.some(x=>x.method==='eth_call'&&x.params[0].data==='0x95d89b41'));
 await assert.rejects(()=>verifiedTokenMetadata420({request:async()=> '0x'},token),/code missing/);
 await assert.rejects(()=>verifiedTokenMetadata420(fakeProvider({unavailable:true}).provider,token),/outage/);
});
test('M4: bounded transfer discovery verifies ERC20 balances and current ERC721 ownership',async()=>{
 const {provider,seen}=fakeProvider();
 const result=await discoverTokens420(provider,address,{fromBlock:0n,toBlock:64n});
 assert.equal(result.tokens.length,1);
 assert.equal(result.tokens[0].symbol,'TKN');
 assert.equal(result.tokens[0].raw,'12500000');
 assert.deepEqual(result.nfts.map(x=>x.tokenId),['42']);
 assert.equal(result.limited,true);
 assert.ok(seen.some(x=>x.method==='eth_getLogs'));
 const wrong=await discoverTokens420(fakeProvider({wrongOwner:true}).provider,address,{fromBlock:0n,toBlock:64n});
 assert.equal(wrong.nfts.length,0,'old NFT transfer must not certify current ownership');
 await assert.rejects(()=>discoverTokens420(provider,address,{fromBlock:0n,toBlock:5000n}),/bounded/);
});
test('M4: balances distinguish verified, pending and unavailable without double-counting',()=>{
 assert.deepEqual(classifyBalance420({raw:'123',status:'verified',pendingRaw:'0'}).status,'spendable');
 const pending=classifyBalance420({raw:'123',status:'verified',pendingRaw:'20'});
 assert.equal(pending.status,'pending');
 assert.equal(pending.spendable,'123','pending transaction does not invent an on-chain reservation');
 assert.equal(classifyBalance420({raw:'100',status:'unavailable'}).spendable,null);
 assert.equal(classifyBalance420({raw:'-1',status:'verified'}).status,'unavailable'); // malformed balances fail closed
});
test('M4: cached quotes retain provenance, reject wrong chain, stale values suppress fiat',()=>{
 const now=1763000000000,price={chainId:'0x1a4',address:token,currency:'CAD',price:'2.50',timestamp:now-1000};
 const quote=validatePrice420(price,{chainId:'0x1a4',address:token,now});
 assert.equal(quote.stale,false);
 assert.equal(fiatValue420('12500000',6,quote),'31.25');
 assert.equal(fiatValue420('12500000',6,null),null);
 assert.throws(()=>validatePrice420(price,{chainId:'0x1',address:token,now}),/mismatch/);
 const stale=validatePrice420(price,{chainId:'0x1a4',address:token,now:now+999000});
 assert.equal(stale.stale,true);
 assert.equal(fiatValue420('12500000',6,stale),null);
 assert.throws(()=>validatePrice420({...price,price:'NaN'},{chainId:'0x1a4',address:token,now}),/price/i);
 assert.throws(()=>validatePrice420({...price,timestamp:now+1000000},{chainId:'0x1a4',address:token,now}),/timestamp/);
});
test('M4: import, hide/spam flags and suspicious metadata cannot silently gain spendable status',()=>{
 const t=checkedToken420({address:token,symbol:'TKN',decimals:6});
 assert.equal(t.verified,false);
 assert.throws(()=>checkedToken420({address:token,symbol:'https://scam',decimals:18}),/symbol/);
 const settings=normalizedPortfolioSettings420({hidden:[token],spam:[token],tokens:[t],fiatCurrency:'CAD'});
 assert.deepEqual(settings.hidden,[token]);
 assert.deepEqual(settings.spam,[token]);
 assert.equal(spamSignals420({...t,spam:true}).suspected,true);
 assert.equal(settings.priceEndpoint,null);
});
test('M4: Chromium-owned popup views and chain scoped operations; no RPC signing',()=>{
 const html=source('popup.html'),popup=source('popup.js'),worker=source('service-worker.js');
 for(const id of ['nfts-view','asset-view','tab-tokens','tab-nfts','tab-activity','token-import-form',
  'portfolio-refresh','discover-assets','portfolio-price-dummy'].slice(0,-1)){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const action of ['portfolio-import','portfolio-discover','portfolio-visibility','portfolio-provider',
   'portfolio-refresh','readAssetPortfolio420','verifiedPrice420','monitorPortfolioBlocks420']){
  assert.ok(worker.includes(action),action);
 }
 assert.ok(worker.includes('portfolioScope420(chainId,selectedAccount)'));
 assert.ok(worker.includes('No approved price provider configured'));
 assert.ok(popup.includes('Fiat total unavailable'));
 assert.ok(popup.includes('Unmark spam'));
 assert.ok(popup.includes('renderNFT420'));
 assert.match(worker,/Raw transaction broadcast is restricted to the local EOA authority/);
 assert.match(worker,/assertEoaRawMatchesAuthority420/);
 assert.doesNotMatch(worker,/READ_METHODS = new Set\(\[[^\]]*eth_sendRawTransaction/);
});
