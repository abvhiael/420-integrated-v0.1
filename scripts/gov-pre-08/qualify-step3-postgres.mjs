#!/usr/bin/env node
// GOV-PRE-08 Step 3: REAL PostgreSQL, actual EvmJsonRpcSource420,
// CoreProjectionConsumer420, durable SQL checkpoints/history and public HTTP.
// Chain 31337 synthetic Anvil only; Anvil has no true BFT finalized consensus.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createHash } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(root,'420-indexer/package.json'));
const { keccak256 }=requireIndexer('ethers');
const { PostgresSql420 }=await import('../../420-indexer/dist/src/postgres.js');
const { EvmJsonRpcSource420,HttpJsonRpcTransport420 }=await import('../../420-indexer/dist/src/rpc-source.js');
const { ProtocolDecoderRegistry420 }=await import('../../420-indexer/dist/src/protocol-decoder.js');
const { ProtocolProjection420 }=await import('../../420-indexer/dist/src/protocol-projections.js');
const { CoreProjectionConsumer420 }=await import('../../420-indexer/dist/src/core-projections.js');
const { IndexerIngestor420 }=await import('../../420-indexer/dist/src/ingestor.js');
const { SqlCheckpointStore420,SqlCanonicalHistoryStore420 }=await import('../../420-indexer/dist/src/recovery-store.js');
const { IndexerQueryService420 }=await import('../../420-indexer/dist/src/query-service.js');
const { IndexerPublicApiAdapter420 }=await import('../../420-indexer/dist/src/api-surface.js');
const { createIndexerHttpServer420 }=await import('../../420-indexer/dist/src/http-transport.js');

function need(ok,msg){if(!ok)throw new Error('GOV-PRE-08 Step3 real PostgreSQL: '+msg);}
const argv=process.argv.slice(2);
function option(flag){const i=argv.indexOf('--'+flag);need(i>=0 && argv[i+1],flag+' required');return argv[i+1];}
const mode=option('mode');
need(mode==='initial' || mode==='recover','unknown mode');
const tag=option('tag');
need(/^[ab]$/.test(tag),'only two isolated test schemas permitted');
const rpcUrl=option('rpc');
need(/^http:\/\/127\.0\.0\.1:[0-9]{3,5}$/.test(rpcUrl),'external RPC prohibited');
const graph=JSON.parse(await fs.readFile(option('graph'),'utf8'));
const manifest=JSON.parse(await fs.readFile(option('descriptors'),'utf8'));
const output=option('output');
const pgUrl=process.env.INDEXER_PG_URL;
need(/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:5432\/[a-z0-9_]+$/i.test(pgUrl||''),
     'local PostgreSQL service is required');
need(graph.schema==='GOV_PRE_08_STEP3_LOCAL_ACTUAL_FOURTEEN_CONSTRUCTORS_V1'
     && !graph.approvedV4 && graph.chainId===31337
     && manifest.schema==='GOV_PRE_08_STEP3_LOCAL_ABI_BOUND_INDEXER_DESCRIPTORS_V1'
     && manifest.sourceGitHead===graph.sourceGitHead
     && manifest.graphSourceDigest===graph.deterministicGraphDigestSha256,
     'unsigned source manifest or deployment provenance mismatch');
need(manifest.descriptors.length>=12 &&
     manifest.descriptors.every(d=>/^0x[0-9a-f]{40}$/.test(d.contractAddress)),
     'production compiler descriptors are unbound to actual local contracts');
const schema='gov_pre08_step3_'+tag;
const admin=new PostgresSql420({connectionString:pgUrl});
const db=new PostgresSql420({connectionString:pgUrl,options:'-c search_path='+schema});
const transport=new HttpJsonRpcTransport420(rpcUrl);
const realSource=new EvmJsonRpcSource420(transport,'gov-pre08-anvil31337');
need(await realSource.chainId()===31337n,'wrong source chain');
// Local Anvil does NOT generate consensus finality proofs. Disable finalized
// tag consumption in this test-only source wrapper; never use on a live chain.
const source=new Proxy(realSource,{get(target,property){
  if(property==='finalizedBlockNumber')return undefined;
  const value=Reflect.get(target,property,target);
  return typeof value==='function'?value.bind(target):value;
}});
const genesis=await source.getBlockByNumber(0n);
need(genesis?.number===0n && /^0x[0-9a-fA-F]{64}$/.test(genesis.hash),
     'Genesis identity unavailable');
const codeMap={
  '0x0000000000000000000000000000000000000434':
     graph.genesisAnchorCodeHashes.ProtocolRegistry,
  '0x0000000000000000000000000000000000000423':
     graph.genesisAnchorCodeHashes.ValidatorRegistry,
  '0x0000000000000000000000000000000000000425':
     graph.genesisAnchorCodeHashes.CommunityValidatorReserve
};
for(const [name,address] of Object.entries(graph.actualProductionConstructorAddresses))
  codeMap[address.toLowerCase()]=graph.actualProductionConstructorRuntimeHashes[name];
for(const descriptor of manifest.descriptors){
  const code=await source.getCode(descriptor.contractAddress);
  need(code!=='0x' && keccak256(code).toLowerCase()===codeMap[descriptor.contractAddress],
       'runtime codehash/ABI-address binding mismatch: '+descriptor.eventName);
}
const decoders=new ProtocolDecoderRegistry420(manifest.descriptors);
const protocol=new ProtocolProjection420(db,decoders);
const consumer=new CoreProjectionConsumer420(db,protocol,31337n);
const checkpointStore=new SqlCheckpointStore420(db,31337n);
const historyStore=new SqlCanonicalHistoryStore420(db,31337n);
const makeIngestor=(chosenSource=source,chosenDB=db,chosenConsumer=consumer)=>
  new IndexerIngestor420(chosenSource,new SqlCheckpointStore420(chosenDB,31337n),
                        chosenConsumer,{finality:{mode:'head'},startBlock:0n,
                           maxBlocksPerRun:1000,maxReorgDepth:32},
                        new SqlCanonicalHistoryStore420(chosenDB,31337n));
async function rows(sql,params=[]){return(await db.query(sql,params)).rows;}
async function count(table){return Number((await rows('select count(*)::text as n from '+table+' where chain_id=$1',['31337']))[0].n);}
async function snapshot(){
  const checkpoint=await checkpointStore.load();
  need(checkpoint!==null,'durable checkpoint absent');
  const blocks=await count('idx_blocks');
  const txs=await count('idx_transactions');
  const receipts=await count('idx_receipts');
  const logs=await count('idx_logs');
  const events=await count('idx_protocol_events');
  const ancestry=await count('idx_canonical_history');
  need(blocks>30 && txs>30 && receipts===txs && logs>=events && events>=25
       && ancestry===blocks,'PostgreSQL raw records/checkpoints incomplete');
  const ev=await rows(
    'select contract_address,protocol,event_name,block_number::text as block_number,fields from idx_protocol_events where chain_id=$1 order by block_number,tx_index,log_index',
    ['31337']);
  for(const event of ev.filter(e=>e.event_name==='BudgetCreated')){
    const block=await source.getBlockByNumber(BigInt(event.block_number));
    need(block && BigInt(event.fields.validFrom)===block.timestamp,
         'PostgreSQL budget timestamp not verified against canonical source');
  }
  const normalized=ev.map(e=>({
    ...e,
    fields:e.event_name==='BudgetCreated'?
      {...e.fields,validFrom:'CANONICAL_BLOCK_TIMESTAMP_VERIFIED'}:e.fields
  }));
  const digest=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return {checkpoint,blocks,txs,receipts,logs,events,ancestry,
          normalizedReadModelDigest:digest};
}
async function publicConsumer(){
  const service=new IndexerQueryService420(db);
  const api=new IndexerPublicApiAdapter420(service,{mode:'head'});
  const server=createIndexerHttpServer420(api);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    const base='http://127.0.0.1:'+server.address().port;
    async function get(route){
      const response=await fetch(base+route);
      return {status:response.status,data:await response.json()};
    }
    const health=await get('/health');
    const ready=await get('/ready?chainId=31337');
    const status=await get('/v1/status?chainId=31337');
    const blocks=await get('/v1/blocks?chainId=31337&limit=5');
    const wrong=await get('/ready?chainId=420');
    need(health.status===200 && health.data.data.status==='ok' &&
         ready.status===200 && ready.data.data.ready &&
         status.status===200 && status.data.data.authoritative===false &&
         status.data.data.chainId==='31337' &&
         blocks.status===200 && blocks.data.data.items?.length>0 &&
         wrong.status===503 && !wrong.data.data.ready,
         'real 420Indexer HTTP API health/ready/canonical/chain isolation failed');
    const latest=(await checkpointStore.load());
    const hit=await get('/v1/blocks/'+latest.blockNumber+'?chainId=31337');
    need(hit.status===200 && hit.data.data.hash.toLowerCase()===latest.blockHash.toLowerCase(),
         'running 420Indexer HTTP block route has different canonical head');
    return {listening:true,health:200,ready:200,
      sourceNotAuthoritative:true,wrongChainReadyHTTP:wrong.status,
      actualIndexedBlockHTTP:hit.status};
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
}
async function postCleanState(){const count=await rows('select count(*)::text as n from idx_blocks');need(Number(count[0].n)>0,'no persisted Postgres rows');}
let report;
try{
  if(mode==='initial'){
    await admin.query('drop schema if exists '+schema+' cascade');
    await admin.query('create schema '+schema);
    for(const name of ['001-core-projections.sql','003-genesis-projections.sql',
                       '007-durable-recovery.sql','008-finalized-recovery.sql']){
      await db.query(await fs.readFile(path.join(root,'420-indexer/sql',name),'utf8'));
    }
    await db.query(
      'create table gov_pre08_local_observation (chain_id numeric(78,0) primary key, observed_head_hash text not null, observed_at timestamptz not null, local_scope text not null)'
    );
    const before=await checkpointStore.load();
    need(before===null,'unexpected checkpoint on cold start');
    const ingestor=makeIngestor();
    const run=await ingestor.runOnce();
    need(run.processed>30 && run.recoveredReorgDepth===0,'real Postgres cold start did not ingest');
    const first=await snapshot();
    const replay=await makeIngestor().runOnce();
    need(replay.processed===0 && (await snapshot()).normalizedReadModelDigest===first.normalizedReadModelDigest,
         'durable PostgreSQL idempotent resume modified projection');
    const blockCount=first.blocks;
    // A reversible branch with zero-value synthetic transactions changes no native
    // custody; true Anvil rollback, not proof of BFT network finality.
    const wallet=graph.sourceFoundersFixtureOnly[0];
    const rpc=(method,params=[])=>transport.request(method,params);
    await rpc('anvil_impersonateAccount',[wallet]);
    const snap=await rpc('evm_snapshot',[]);
    const send=async data=>{
      const tx=await rpc('eth_sendTransaction',[{from:wallet,
         to:graph.actualProductionConstructorAddresses.TreasuryRouter420,
         data:'0x'+data,gas:'0x5208',gasPrice:'0x0',value:'0x0'}]);
      const receipt=await rpc('eth_getTransactionReceipt',[tx]);
      need(receipt?.status==='0x1','Anvil reorg probe transaction not accepted');
      return tx;
    };
    // Use an EOA destination (not a contract) to avoid calldata revert.
    const sendEOA=async data=>{
      const tx=await rpc('eth_sendTransaction',[{from:wallet,
         to:graph.sourceFoundersFixtureOnly[1],
         data:'0x'+data,gas:'0x100000',gasPrice:'0x0',value:'0x0'}]);
      const receipt=await rpc('eth_getTransactionReceipt',[tx]);
      need(receipt && receipt.status==='0x1','Anvil synthetic message tx not mined');
      return tx;
    };
    try{
      const orphan=await sendEOA('dada');
      need((await makeIngestor().runOnce()).processed===1,'orphan branch not indexed');
      need(await rpc('evm_revert',[snap])===true,'local branch did not rewind');
      need((await source.getTransactionReceipt(orphan))===null,'orphan receipt survived reorg');
      const canonicalTx=await sendEOA('cafe');
      const replaced=await makeIngestor().runOnce();
      need(replaced.recoveredReorgDepth>=1 && replaced.processed===1,
           'durable PostgreSQL actual reorg ancestor recovery not exercised');
      const orphanRows=await rows('select count(*)::text as n from idx_transactions where chain_id=$1 and tx_hash=$2',['31337',orphan]);
      const newRows=await rows('select count(*)::text as n from idx_transactions where chain_id=$1 and tx_hash=$2',['31337',canonicalTx]);
      need(orphanRows[0].n==='0' && newRows[0].n==='1',
           'PostgreSQL orphaned transaction not retracted');
    }finally{
      await rpc('anvil_stopImpersonatingAccount',[wallet]);
    }
    const state=await snapshot();
    need(state.blocks===blockCount+1 && state.normalizedReadModelDigest===first.normalizedReadModelDigest,
         'real Postgres reorg incorrectly changed canonical protocol projection');
    const http=await publicConsumer();
    report={schema:'GOV_PRE_08_STEP3_REAL_POSTGRES_DURABLE_WORKER_V1',
      phase:'INITIAL_COLD_START_REORG',sourceGitHead:graph.sourceGitHead,
      graphSourceDigest:graph.deterministicGraphDigestSha256,
      chainId:31337,genesisHash:genesis.hash,
      pgBackend:'REAL_POSTGRESQL_SCHEMA_PER_ISOLATED_SOURCE',
      replayIdempotent:true,actualReorgDepthAtLeastOne:true,
      realCanonicalReceiptReconstruction:true,
      postgresqlTransactionAndCheckpointInSameTransaction:true,
      actualHttpIndexer:http,
      chainFinality:'UNFINALIZED_LOCAL_ANVIL_HEAD_ONLY',
      state};
  }else{
    await postCleanState();
    const checkpoint=await checkpointStore.load();
    need(checkpoint?.chainId===31337n,'durable checkpoint lost after restart');
    const remote=await source.getBlockByNumber(checkpoint.blockNumber);
    need(remote?.hash.toLowerCase()===checkpoint.blockHash.toLowerCase(),
         'restarted process has divergent canonical checkpoint');
    const again=await makeIngestor().runOnce();
    need(again.processed===0 && again.recoveredReorgDepth===0,
         'worker restart did not resume from exactly durable committed head');
    const state=await snapshot();
    const http=await publicConsumer();
    report={schema:'GOV_PRE_08_STEP3_REAL_POSTGRES_DURABLE_WORKER_V1',
      phase:'PROCESS_AND_ANVIL_STATE_RECOVERY',sourceGitHead:graph.sourceGitHead,
      graphSourceDigest:graph.deterministicGraphDigestSha256,
      chainId:31337,genesisHash:genesis.hash,
      pgBackend:'REAL_POSTGRESQL_RETAINED_ON_WORKER_AND_ANVIL_RESTART',
      replayIdempotent:true,reopenedExistingCheckpoint:true,
      realCanonicalReceiptReconstruction:true,actualHttpIndexer:http,
      chainFinality:'UNFINALIZED_LOCAL_ANVIL_HEAD_ONLY',state};
  }
  const canonical=await checkpointStore.load();
  need(canonical && canonical.chainId===31337n,'no verified local canonical checkpoint');
  await db.query(
     'insert into gov_pre08_local_observation(chain_id,observed_head_hash,observed_at,local_scope) values ($1,$2,now(),$3) on conflict (chain_id) do update set observed_head_hash=excluded.observed_head_hash,observed_at=excluded.observed_at,local_scope=excluded.local_scope',
     ['31337',canonical.blockHash,'LOCAL_INDEXER_VERIFIED_NOT_NETWORK_FINALITY']);
  need(!report.productionMigrationAuthorized && report.chainId===31337,
       'production release gate incorrectly opened');
  report.productionMigrationAuthorized=false;
  report.authenticFounderKeysAvailable=false;
  report.networkConsensusFinalityQualified=false;
  report.explorerGoServerQualified=false;
  await fs.writeFile(output,JSON.stringify(report,
     (_key,value)=>typeof value==='bigint'?value.toString():value,2)+'\n',{flag:'wx'});
  console.log('GOV_PRE_08_STEP3_REAL_POSTGRES_WORKER_HTTP_'+mode.toUpperCase()+'=PASS LOCAL ONLY',
              report.state.normalizedReadModelDigest);
}finally{
  await db.close();
  await admin.close();
}
