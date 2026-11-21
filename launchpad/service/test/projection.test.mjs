import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {ProjectionStore} from '../core/projection.mjs';
const sale=n=>'0x'+n.toString(16).padStart(64,'0');
const project=n=>'0x'+(n+100).toString(16).padStart(64,'0');
const deps={saleRegistryAddress:'0x0000000000000000000000000000000000001002',
  projectRegistryAddress:'0x0000000000000000000000000000000000001005'};
const source=hash=>({chainId:'0x1a4',blockNumber:'0x10',blockHash:hash,...deps});
test('projection requires canonical provenance and supports campaign lookup',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp-'));const file=path.join(dir,'projection.json');fs.writeFileSync(file,JSON.stringify({schema:'420-launchpad-projection-v1',canonical:true,source:source('0x'+'ab'.repeat(32)),items:[{saleId:sale(1),projectId:project(1),mode:'REWARD',state:'ACTIVE'}]}));const p=new ProjectionStore(file);assert.equal(p.campaigns().items.length,1);assert.equal(p.campaign(sale(1)).campaign.saleId,sale(1));assert.throws(()=>p.campaign(sale(99)),/not found/);fs.writeFileSync(file,JSON.stringify({schema:'bad',canonical:false}));assert.throws(()=>p.read(),/invalid Launchpad projection/);});

test('filtered discovery paginates deterministically and rejects stale cursors and invalid filters',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'launchpad-search-')),file=path.join(dir,'catalog.json');
  const data={schema:'420-launchpad-projection-v1',canonical:true,
    source:source('0x'+'cd'.repeat(32)),
    items:[
      {saleId:sale(1),projectId:project(1),title:'Green forest',mode:'REWARD',state:'ACTIVE'},
      {saleId:sale(2),projectId:project(2),title:'Blue sky',mode:'DONATION',state:'FAILED'},
      {saleId:sale(3),projectId:project(3),title:'Green hills',mode:'REWARD',state:'ACTIVE'}
    ]};
  fs.writeFileSync(file,JSON.stringify(data));const store=new ProjectionStore(file,'0x1a4');
  const first=store.campaigns({search:'GREEN',mode:'REWARD',state:'ACTIVE',limit:1});
  assert.deepEqual(first.items.map(x=>x.saleId),[sale(1)]);assert.equal(first.total,2);
  const next=store.campaigns({search:'green',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor});
  assert.deepEqual(next.items.map(x=>x.saleId),[sale(3)]);assert.equal(next.nextCursor,null);
  assert.throws(()=>store.campaigns({search:'blue',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor}),/stale campaign cursor/);
  assert.throws(()=>store.campaigns({mode:'EQUITY'}),/invalid campaign mode/);
  assert.throws(()=>store.campaigns({limit:9000}),/page size/);
  data.source.blockHash='0x'+'ee'.repeat(32);fs.writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>store.campaigns({search:'green',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor}),/stale campaign cursor/);
  data.items.push({...data.items[0]});fs.writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>store.read(),/invalid campaign projection inventory/);
  data.items.pop();
  for(const invalid of [{raised:'NaN'},{title:'A'.repeat(1200)},{controller:'not-an-address'},
    {startsAt:1.5},{summary:'Line'+String.fromCharCode(0)+'break'}]){
    data.items[0]={saleId:sale(1),projectId:project(1),title:'Green forest',mode:'REWARD',state:'ACTIVE',...invalid};
    fs.writeFileSync(file,JSON.stringify(data));
    assert.throws(()=>store.read(),/invalid campaign projection inventory/);
  }
});

test('projection verification rejects reorgs, stale heads, cross-network and wrong Registry bindings',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'launchpad-provenance-')),file=path.join(dir,'catalog.json');
  const d={schema:'420-launchpad-projection-v1',canonical:true,source:source('0x'+'ab'.repeat(32)),
    items:[{saleId:sale(1),projectId:project(1),mode:'REWARD',state:'ACTIVE'}]};
  fs.writeFileSync(file,JSON.stringify(d));
  const p=new ProjectionStore(file,'0x1a4',{maxLagBlocks:8});
  let current='0x'+'ab'.repeat(32),head=16n,chain='0x1a4';
  const rpc={call:async(method,params)=>{
    if(method==='eth_chainId')return chain;
    if(method==='eth_getBlockByNumber'){
      const n=params[0]==='latest'?head:BigInt(params[0]);
      return {number:'0x'+n.toString(16),hash:n===16n?current:'0x'+'cd'.repeat(32)};
    }
    throw Error(method);
  }};
  assert.equal((await p.verify(rpc,deps)).items.length,1);
  current='0x'+'ef'.repeat(32);
  await assert.rejects(()=>p.verify(rpc,deps),/stale, orphaned/);
  current=d.source.blockHash;head=30n;
  await assert.rejects(()=>p.verify(rpc,deps),/stale, orphaned/);
  head=16n;chain='0x1';
  await assert.rejects(()=>p.verify(rpc,deps),/stale, orphaned/);
  chain='0x1a4';
  await assert.rejects(()=>p.verify(rpc,{...deps,saleRegistryAddress:'0x000000000000000000000000000000000000f00d'}),/dependency mismatch/);
  d.source.blockNumber='garbage';fs.writeFileSync(file,JSON.stringify(d));
  assert.throws(()=>p.read(),/projection provenance incomplete/);
});
