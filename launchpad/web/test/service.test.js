import test from 'node:test';import assert from 'node:assert/strict';import {LaunchpadService,normalizeCampaign,progress} from '../core/service.js';
function response(body,status=200){return {ok:status>=200&&status<300,status,json:async()=>body};}
test('service rejects projections without canonical provenance',async()=>{const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl:async()=>response({schema:'420-launchpad-projection-v1',canonical:false})});await assert.rejects(()=>s.campaigns(),/canonical provenance/);});
test('service accepts canonical discovery and normalizes progress',async()=>{const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl:async()=>response({schema:'420-launchpad-projection-v1',canonical:true,source:{chainId:'0x1a4',blockHash:'0x'+'ab'.repeat(32)},items:[]})});assert.equal((await s.campaigns()).items.length,0);const c=normalizeCampaign({saleId:'s',projectId:'p',raised:'50',hardCap:'200'});assert.equal(progress(c),25);});
test('transaction review must be canonical and have valid target/calldata',async()=>{const good={schema:'420-launchpad-transaction-review-v1',canonical:true,transaction:{to:'0x0000000000000000000000000000000000001002',data:'0x1234'}};const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl:async()=>response(good)});assert.equal((await s.prepare('claim',{})).canonical,true);good.transaction.to='bad';await assert.rejects(()=>s.prepare('claim',{}),/invalid canonical transaction/);});

test('search and pagination query preserves canonical provenance',async()=>{
  const urls=[],fetchImpl=async url=>{urls.push(url);return response({schema:'420-launchpad-projection-v1',canonical:true,
    source:{chainId:'0x1a4',blockHash:'0x'+'ab'.repeat(32)},items:[],nextCursor:'cursor2',total:2});};
  const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl});
  const p=await s.campaigns({search:'green & gold',mode:'REWARD',state:'ACTIVE',limit:1,cursor:'abc'});
  assert.equal(p.total,2);const q=new URL(urls[0]).searchParams;
  assert.equal(q.get('search'),'green & gold');assert.equal(q.get('mode'),'REWARD');assert.equal(q.get('state'),'ACTIVE');
  assert.equal(q.get('limit'),'1');assert.equal(q.get('cursor'),'abc');
});
test('checkout rejects untrusted payment origin and incorrect invoice identity',async()=>{
  const sale='0x'+'11'.repeat(32),account='0x000000000000000000000000000000000000a11c';
  const fixture={schema:'420-launchpad-checkout-v1',canonical:true,source:{chainId:'0x1a4',blockHash:'0x'+'ab'.repeat(32)},
    saleId:sale,invoiceId:'0x'+'bb'.repeat(32),checkoutUrl:'https://malicious.invalid/#pay?v=1&kind=invoice&chain=420&id=x'};
  const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl:async()=>response(fixture)});
  await assert.rejects(()=>s.checkout(sale,account,'42','99'),/untrusted 420Pay/);
  fixture.checkoutUrl=null;fixture.invoiceId='wrong';
  await assert.rejects(()=>s.checkout(sale,account,'42','99'),/canonical invoice/);
});
test('a conversion quote cannot be substituted with a different target or missing canonical provenance',async()=>{
  const sale='0x'+'11'.repeat(32),account='0x000000000000000000000000000000000000a11c';
  const src={chainId:'0x1a4',blockHash:'0x'+'ab'.repeat(32)};
  const fixture={schema:'420-launchpad-conversion-quote-v1',canonical:true,source:src,saleId:sale,quoteId:'0x'+'22'.repeat(32),
    paymentRouterAddress:'0x0000000000000000000000000000000000001001',
    transaction:{data:'0x12345678'},approval:{to:'0x0000000000000000000000000000000000001002',spender:'0x0000000000000000000000000000000000001003'}};
  const s=new LaunchpadService({baseUrl:'https://api.example',fetchImpl:async()=>response(fixture)});
  assert.equal((await s.conversionQuote(sale,account,{amount:'50',nonce:'20'})).quoteId,fixture.quoteId);
  fixture.source.blockHash='unknown';
  await assert.rejects(()=>s.conversionQuote(sale,account,{amount:'50',nonce:'20'}),/untrusted/);
});
