import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {ProjectionStore} from '../core/projection.mjs';
test('projection requires canonical provenance and supports campaign lookup',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp-'));const file=path.join(dir,'projection.json');fs.writeFileSync(file,JSON.stringify({schema:'420-launchpad-projection-v1',canonical:true,source:{chainId:'0x1a4',blockHash:'0x'+'ab'.repeat(32)},items:[{saleId:'sale-1',projectId:'project-1'}]}));const p=new ProjectionStore(file);assert.equal(p.campaigns().items.length,1);assert.equal(p.campaign('sale-1').campaign.saleId,'sale-1');assert.throws(()=>p.campaign('missing'),/not found/);fs.writeFileSync(file,JSON.stringify({schema:'bad',canonical:false}));assert.throws(()=>p.read(),/invalid Launchpad projection/);});

test('filtered discovery paginates deterministically and rejects stale cursors and invalid filters',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'launchpad-search-')),file=path.join(dir,'catalog.json');
  const data={schema:'420-launchpad-projection-v1',canonical:true,
    source:{chainId:'0x1a4',blockHash:'0x'+'cd'.repeat(32)},
    items:[
      {saleId:'a',projectId:'p1',title:'Green forest',mode:'REWARD',state:'ACTIVE'},
      {saleId:'b',projectId:'p2',title:'Blue sky',mode:'DONATION',state:'FAILED'},
      {saleId:'c',projectId:'p3',title:'Green hills',mode:'REWARD',state:'ACTIVE'}
    ]};
  fs.writeFileSync(file,JSON.stringify(data));const store=new ProjectionStore(file,'0x1a4');
  const first=store.campaigns({search:'GREEN',mode:'REWARD',state:'ACTIVE',limit:1});
  assert.deepEqual(first.items.map(x=>x.saleId),['a']);assert.equal(first.total,2);
  const next=store.campaigns({search:'green',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor});
  assert.deepEqual(next.items.map(x=>x.saleId),['c']);assert.equal(next.nextCursor,null);
  assert.throws(()=>store.campaigns({search:'blue',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor}),/stale campaign cursor/);
  assert.throws(()=>store.campaigns({mode:'EQUITY'}),/invalid campaign mode/);
  assert.throws(()=>store.campaigns({limit:9000}),/page size/);
  data.source.blockHash='0x'+'ee'.repeat(32);fs.writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>store.campaigns({search:'green',mode:'REWARD',state:'ACTIVE',limit:1,cursor:first.nextCursor}),/stale campaign cursor/);
  data.items.push({...data.items[0]});fs.writeFileSync(file,JSON.stringify(data));
  assert.throws(()=>store.read(),/invalid campaign projection inventory/);
});
