import test from 'node:test';
import assert from 'node:assert/strict';
import { HybridAIReadSource420, type Hex32, type Address420 } from '../src/index.js';

const h=(c:string)=>('0x'+c.repeat(64)) as Hex32;
const a=(c:string)=>('0x'+c.repeat(40)) as Address420;
const status={chainId:'420',observedBlock:'100',observedAtMs:1000,stale:false,ready:true};

test('hybrid source uses indexer for discovery and RPC for canonical hydration', async()=>{
  const providerId=h('1');
  const source=new HybridAIReadSource420(
    {
      providerIds:async()=>({ids:[providerId],nextCursor:null}),
      modelIds:async()=>({ids:[],nextCursor:null}),
      modelVersionIds:async()=>({ids:[],nextCursor:null}),
      jobIds:async()=>({ids:[],nextCursor:null}),
      jobEvents:async()=>({items:[],nextCursor:null}),
      status:async()=>status
    },
    {
      provider:async(id)=>({providerId:id,operatorAccount:a('1'),settlementAccount:a('2'),computeProviderId:h('2'),metadataHash:h('3'),state:'ACTIVE',stakeRef:h('4'),revision:1}),
      model:async()=>null,
      modelVersion:async()=>null,
      job:async()=>null,
      status:async()=>status
    }
  );
  const page=await source.providers({limit:10});
  assert.equal(page.items.length,1);
  assert.equal(page.items[0]!.meta.source,'hybrid');
  assert.equal(page.items[0]!.meta.authoritative,false);
});

test('hybrid source fails closed on index/RPC chain mismatch', async()=>{
  const source=new HybridAIReadSource420(
    {
      providerIds:async()=>({ids:[],nextCursor:null}),
      modelIds:async()=>({ids:[],nextCursor:null}),
      modelVersionIds:async()=>({ids:[],nextCursor:null}),
      jobIds:async()=>({ids:[],nextCursor:null}),
      jobEvents:async()=>({items:[],nextCursor:null}),
      status:async()=>status
    },
    {
      provider:async()=>null,model:async()=>null,modelVersion:async()=>null,job:async()=>null,
      status:async()=>({...status,chainId:'421'})
    }
  );
  await assert.rejects(source.status(),/chain mismatch/);
});
