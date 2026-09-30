import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCandidateMatchesEntry,buildMetadataSwapReviewRequest,normalizeReviewCatalogue,parseDisplayUnits} from '../core/read-only-swap-entry.js';

const address=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const account=address(1),recipient=address(2),input=address(3),output=address(4);
const assetIn=id(100),assetOut=id(101),marketId=id(200);
const catalogue={
 schema:'420-exchange-review-catalogue-v1',qualification:'QUALIFIED_CONFIG',authority:'METADATA_ONLY',demo:false,fixture:false,chainId:'0x420',maxRouteHops:2,
 assets:[
  {assetId:assetIn,address:input,symbol:'BOB',name:'Bob Token',decimals:18,verified:true,reviewEligible:true},
  {assetId:assetOut,address:output,symbol:'ARRR',name:'Arrr Token',decimals:6,verified:true,reviewEligible:true},
 ],
 markets:[{marketId,inputAssetId:assetIn,outputAssetId:assetOut,label:'BOB → ARRR',active:true,reviewEligible:true}],
};
const runtime={network:{chainId:'0x420'},reviewCatalogue:catalogue};

test('PRE-03 decimal entry converts exactly to canonical raw units without floating point',()=>{
 assert.equal(parseDisplayUnits('1',18),'1000000000000000000');
 assert.equal(parseDisplayUnits('1.000000000000000001',18),'1000000000000000001');
 assert.equal(parseDisplayUnits('4.1',6),'4100000');
 assert.equal(parseDisplayUnits('0.000001',6),'1');
 for(const value of ['0','1e6','-1','1.0000001','01','  ','1.'])assert.throws(()=>parseDisplayUnits(value,6));
});

test('PRE-03 catalogue accepts only qualified unique configured metadata on the runtime chain',()=>{
 const normalized=normalizeReviewCatalogue(runtime);
 assert.equal(normalized.markets[0].input.address,input);
 assert.equal(normalized.markets[0].output.decimals,6);
 for(const change of [
  {qualification:'UNRESOLVED'},
  {authority:'EXECUTION'},
  {demo:true},
  {fixture:true},
  {chainId:'0x421'},
  {assets:[catalogue.assets[0],{...catalogue.assets[1],address:input}]},
  {assets:[catalogue.assets[0],{...catalogue.assets[1],assetId:assetIn}]},
  {markets:[catalogue.markets[0],{...catalogue.markets[0],marketId:id(201)}]},
 ]){
  assert.throws(()=>normalizeReviewCatalogue({...runtime,reviewCatalogue:{...catalogue,...change}}));
 }
});

test('PRE-03 request derives addresses and raw amounts only from selected metadata',()=>{
 const entry=buildMetadataSwapReviewRequest({runtime,account,recipient,marketId,amountIn:'1.25',minimumOutput:'4.1'});
 assert.deepEqual(entry.request,{
  account,tokenIn:input,tokenOut:output,recipient,
  amountInRaw:'1250000000000000000',minimumOutputRaw:'4100000',
 });
 assert.equal(entry.market.marketId,marketId);
 assert.throws(()=>buildMetadataSwapReviewRequest({runtime,account,recipient,marketId:id(999),amountIn:'1',minimumOutput:'1'}),e=>e.code==='MARKET_UNAVAILABLE');
 assert.throws(()=>buildMetadataSwapReviewRequest({runtime,account,recipient:'bad',marketId,amountIn:'1',minimumOutput:'1'}),e=>e.code==='INVALID_RECIPIENT');
});

test('PRE-03 candidate must preserve selected metadata pair and bounded route size',()=>{
 const entry=buildMetadataSwapReviewRequest({runtime,account,recipient,marketId,amountIn:'1',minimumOutput:'4'});
 const good={projection:{input:{address:input},output:{address:output},hops:[{marketId:id(1)}]}};
 assert.equal(assertCandidateMatchesEntry(good,entry),good);
 assert.throws(()=>assertCandidateMatchesEntry({projection:{...good.projection,input:{address:address(9)}}},entry),e=>e.code==='ASSET_MISMATCH');
 assert.throws(()=>assertCandidateMatchesEntry({projection:{...good.projection,hops:[{},{},{}]}},entry),e=>e.code==='ROUTE_TOO_LARGE');
});
