import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenDiscoverySession420,readCreatedTokenPage420,TOKEN_TEMPLATES_420} from '../core/token-app.js';
import {connected,enableTokenPortfolioFixture420,portfolioRecord420} from './token-connected-fixture.js';
import {controller,account,addr,digest} from './token-test-fixture.js';
const start=(s,f)=>s.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
async function setup(rows){const f=connected(),control=enableTokenPortfolioFixture420(f,rows),session=createTokenDiscoverySession420();assert.equal((await start(session,f)).status,'verified');return {f,control,session};}
test('rebuild all eight created profiles from factory independent of local submission, current owner and holdings distinct',async()=>{
  const rows=TOKEN_TEMPLATES_420.map((p,i)=>portfolioRecord420(i,p,account,i===0?addr(99):i===1?addr(0):account));
  const {f,session}=await setup([...rows,portfolioRecord420(99,TOKEN_TEMPLATES_420[0],addr(98))]);
  const result=await session.refreshPortfolio();assert.ok(result,session.getPortfolio().error);assert.equal(result.items.length,8);assert.equal(result.page.complete,true);
  assert.equal(result.page.createdCount,'8');assert.equal(result.page.total,'9');assert.equal(result.page.authority,'FACTORY_PROVENANCE_ONLY');
  for(const r of result.items){assert.equal(r.creator,account);assert.equal(r.receipt.status,'verified');assert.equal(r.receipt.creationFeeWei,(42n*10n**18n).toString());assert.equal(r.version,1);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.receipt));}
  assert.equal(result.items.find(r=>r.token===rows[0].token).ownership,'transferred');
  assert.equal(result.items.find(r=>r.token===rows[1].token).ownership,'renounced');
  const multi=result.items.find(r=>r.standard==='ERC1155');assert.equal(multi.balance,null);assert.equal(multi.totalSupply,null);assert.equal(multi.uri,'ipfs://example/{id}.json');
  assert.ok(f.calls.every(([m])=>! /send|sign|requestAccounts/i.test(m)));
  const reload=createTokenDiscoverySession420();await start(reload,f);assert.deepEqual((await reload.refreshPortfolio()).items,result.items);
});
test('bounded newest-first scan, explicit partial result and coherent pinned pagination',async()=>{
  const rows=Array.from({length:34},(_,i)=>portfolioRecord420(i,TOKEN_TEMPLATES_420[i%8],i===0||i===17?account:addr(99)));
  const {session,f}=await setup(rows);let result=await session.refreshPortfolio();assert.ok(result,session.getPortfolio().error);assert.equal(result.page.remaining,'18');assert.equal(result.items.length,0);assert.equal(result.page.complete,false);
  result=await session.refreshPortfolio(true);assert.equal(result.page.remaining,'2');assert.equal(result.items.length,1);assert.equal(result.page.complete,false);
  result=await session.refreshPortfolio(true);assert.equal(result.page.complete,true);assert.equal(result.items.length,2);assert.equal(result.items[0].token,rows[17].token);
  const calls=f.calls.filter(([m,a])=>m==='eth_call'&&a[0].to===f.binding.factory.address);assert.ok(calls.every(([,a])=>a[1]==='0x10'));
  assert.equal(await session.refreshPortfolio(true),null);
});
test('empty creator count does not scan unrelated deployments',async()=>{
  const {session}=await setup([portfolioRecord420(1,TOKEN_TEMPLATES_420[0],addr(99))]);
  const r=await session.refreshPortfolio();assert.equal(r.page.complete,true);assert.equal(r.items.length,0);assert.equal(r.page.createdCount,'0');
});
test('receipt unavailability or bad fee is record-only, hostile metadata is inert and unavailable',async()=>{
  for(const mode of ['receiptUnavailable','corruptFee','unsafeMetadata']){
    const {session,control}=await setup([portfolioRecord420(1)]);control[mode]=true;
    const r=await session.refreshPortfolio();assert.ok(r,session.getPortfolio().error);const item=r.items[0];
    if(mode==='unsafeMetadata'){assert.equal(item.name,null);assert.equal(item.metadataStatus,'partial');assert.equal(item.receipt.status,'verified');}
    else{assert.equal(item.receipt.status,'unverified');assert.equal(item.receipt.txHash,undefined);}
  }
});
test('mismatched template, duplicate record, creator count and wrong chain or genesis fail closed',async()=>{
  for(const mode of ['corruptTemplate','duplicate','wrongCount','chain','genesis']){
    const {session,control,f}=await setup([portfolioRecord420(1),portfolioRecord420(2)]);
    if(mode==='wrongCount')control.wrongCount=3;
    else if(mode==='chain')f.tokenControl.chain='0x1';
    else if(mode==='genesis')f.tokenControl.genesisHash=digest(99);
    else control[mode]=true;
    assert.equal(await session.refreshPortfolio(),null,mode);assert.equal(session.getPortfolio().status,'blocked');assert.equal(session.getPortfolio().items.length,0);
  }
});
test('reorganization during pagination removes prior rows, disconnect in-flight cannot resurrect them',async()=>{
  const rows=Array.from({length:18},(_,i)=>portfolioRecord420(i,TOKEN_TEMPLATES_420[0],i===0||i===17?account:addr(99)));
  const {session,control,f}=await setup(rows);assert.equal((await session.refreshPortfolio()).items.length,1);
  control.reorg=true;assert.equal(await session.refreshPortfolio(true),null);assert.equal(session.getPortfolio().items.length,0);
  control.reorg=false;assert.ok(await session.refreshPortfolio());let release;const gate=new Promise(r=>release=r),original=f.provider.request;
  f.provider.request=async(...a)=>{await gate;return original(...a);};
  const pending=session.refreshPortfolio(true);session.invalidate();release();assert.equal(await pending,null);assert.equal(session.getPortfolio().status,'idle');assert.equal(session.getPortfolio().items.length,0);
});
