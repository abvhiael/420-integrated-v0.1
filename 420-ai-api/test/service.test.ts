import test from 'node:test';
import assert from 'node:assert/strict';
import { AIReadApi420, type AIReadSource420, type Hex32, type Address420 } from '../src/index.js';

const h=(c:string)=>('0x'+c.repeat(64)) as Hex32;
const a=(c:string)=>('0x'+c.repeat(40)) as Address420;
const meta={authoritative:false as const,source:'rpc' as const,chainId:'420',observedBlock:'100',observedAtMs:1000,stale:false};

function source(): AIReadSource420 {
  return {
    source:'rpc',
    providers: async () => ({items:[{providerId:h('1'),operatorAccount:a('1'),settlementAccount:a('2'),computeProviderId:h('2'),metadataHash:h('3'),state:'ACTIVE',stakeRef:h('4'),revision:1,meta}],nextCursor:null}),
    models: async () => ({items:[],nextCursor:null}),
    modelVersions: async () => ({items:[],nextCursor:null}),
    jobs: async () => ({items:[],nextCursor:null}),
    job: async () => null,
    jobEvents: async () => ({items:[],nextCursor:null}),
    status: async () => ({chainId:'420',observedBlock:'100',observedAtMs:1000,stale:false,ready:true})
  };
}

test('read API exposes explicit non-authoritative health/readiness', async()=>{
  const api=new AIReadApi420(source());
  assert.deepEqual(await api.health(),{status:'ok',service:'420-ai-api',apiVersion:'v1',authoritative:false});
  const ready=await api.readiness();
  assert.equal(ready.ready,true);
  assert.equal(ready.authoritative,false);
});

test('provider list validates state and returns source provenance', async()=>{
  const api=new AIReadApi420(source());
  const page=await api.providers({state:'ACTIVE',limit:10});
  assert.equal(page.items.length,1);
  assert.equal(page.meta.authoritative,false);
  assert.equal(page.meta.source,'rpc');
  await assert.rejects(api.providers({state:'BROKEN'}),/invalid provider state/);
});

test('API rejects malformed ids, addresses, cursors and oversized limits', async()=>{
  const api=new AIReadApi420(source());
  await assert.rejects(api.jobs({requester:'0x1234'}),/invalid address/);
  await assert.rejects(api.job('0x1234'),/bytes32/);
  await assert.rejects(api.providers({cursor:'%%%'}),/invalid cursor/);
  await assert.rejects(api.providers({limit:201}),/between 1 and 200/);
});
