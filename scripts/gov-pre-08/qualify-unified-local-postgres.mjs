#!/usr/bin/env node
// Actual production TS Indexer + durable PostgreSQL against the SAME patched
// node420 chain consumed by the BLS-certified Go Indexer/Explorer. Native
// engine420 system-call logs are indexed by Go; do not fabricate user tx hashes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(root,'420-indexer/package.json'));
const {keccak256}=requireIndexer('ethers');
const {PostgresSql420}=await import('../../420-indexer/dist/src/postgres.js');
const {EvmJsonRpcSource420,HttpJsonRpcTransport420}=await import('../../420-indexer/dist/src/rpc-source.js');
const {ProtocolDecoderRegistry420}=await import('../../420-indexer/dist/src/protocol-decoder.js');
const {ProtocolProjection420}=await import('../../420-indexer/dist/src/protocol-projections.js');
const {CoreProjectionConsumer420}=await import('../../420-indexer/dist/src/core-projections.js');
const {IndexerIngestor420}=await import('../../420-indexer/dist/src/ingestor.js');
const {SqlCheckpointStore420,SqlCanonicalHistoryStore420}=await import('../../420-indexer/dist/src/recovery-store.js');
const {IndexerQueryService420}=await import('../../420-indexer/dist/src/query-service.js');
const {IndexerPublicApiAdapter420}=await import('../../420-indexer/dist/src/api-surface.js');
const {createIndexerHttpServer420}=await import('../../420-indexer/dist/src/http-transport.js');
function need(x,m){if(!x)throw Error('GOV-PRE-08 unified PostgreSQL: '+m);}
const a=process.argv.slice(2);
function opt(k){let i=a.indexOf('--'+k);need(i>=0 && a[i+1],k+' required');return a[i+1];}
const sourceUrl=opt('rpc'),expected=opt('expected-block-hash').toLowerCase();
need(/^http:\/\/127\.0\.0\.1:\d{3,5}$/.test(sourceUrl),'only loopback execution permitted');
need(/^0x[0-9a-f]{64}$/.test(expected),'missing exact native source head');
const graph=JSON.parse(await fs.readFile(opt('graph'),'utf8'));
need(graph.chainId===31337 && graph.approvedV4===false &&
     graph.authenticFounderOwnersVerified===false,
     'synthetic source manifest may not be promoted');
const dsn=process.env.INDEXER_PG_URL;
need(/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:5432\/[a-z0-9_]+$/i.test(dsn||''),
     'real isolated local PostgreSQL required');
const transport=new HttpJsonRpcTransport420(sourceUrl);
const source=new EvmJsonRpcSource420(transport,'gov-pre08-unified-node420');
need(await source.chainId()===420n,'production Indexer wrong source chain');
const first=await source.getBlockByNumber(0n);
const head=await source.getBlockByNumber(2n);
const walletHash=opt('expected-tx-hash').toLowerCase();
need(/^0x[0-9a-f]{64}$/.test(walletHash),'missing locally signed wallet transaction');
need(first?.number===0n && head?.number===2n && head?.hash.toLowerCase()===expected,
     'PostgreSQL source is not same certified execution head');
for(const [name,address] of Object.entries(graph.actualProductionConstructorAddresses)){
  const code=await source.getCode(address);
  need(code!=='0x' && keccak256(code).toLowerCase()===
       graph.actualProductionConstructorRuntimeHashes[name].toLowerCase(),
       'actual constructor code mismatch on native-chain Geth: '+name);
}
const schema='gov_pre08_unified_chain420';
const admin=new PostgresSql420({connectionString:dsn});
let db=new PostgresSql420({connectionString:dsn,options:'-c search_path='+schema});
try{
  await admin.query('drop schema if exists '+schema+' cascade');
  await admin.query('create schema '+schema);
  for(const name of ['001-core-projections.sql','003-genesis-projections.sql',
                     '007-durable-recovery.sql','008-finalized-recovery.sql']){
    await db.query(await fs.readFile(path.join(root,'420-indexer/sql',name),'utf8'));
  }
  // Contracts were imported into Genesis, hence old Anvil transaction receipts
  // do NOT exist in this new chain's transaction trie. ABI decoder starts empty
  // for those events; producing imaginary transaction hashes is prohibited.
  const descriptors=new ProtocolDecoderRegistry420([]);
  function ingestor(conn){
    const protocol=new ProtocolProjection420(conn,descriptors);
    const consumer=new CoreProjectionConsumer420(conn,protocol,420n);
    const chainSource=new Proxy(source,{get(obj,key){
      if(key==='finalizedBlockNumber')return undefined;
      const v=Reflect.get(obj,key,obj);
      return typeof v==='function'?v.bind(obj):v;
    }});
    return new IndexerIngestor420(chainSource,new SqlCheckpointStore420(conn,420n),
       consumer,{finality:{mode:'head'},startBlock:0n,maxBlocksPerRun:32,maxReorgDepth:12},
       new SqlCanonicalHistoryStore420(conn,420n));
  }
  const result=await ingestor(db).runOnce();
  need(result.processed===3,'cold PostgreSQL ingest did not capture exact 0/1/2 blocks');
  const checkpoint=new SqlCheckpointStore420(db,420n);
  const cp=await checkpoint.load();
  need(cp?.blockNumber===2n && cp.blockHash.toLowerCase()===expected,
       'PostgreSQL checkpoint not same certified execution hash');
  const rows=await db.query('select block_number::text as n,block_hash from idx_blocks where chain_id=$1 order by block_number',['420']);
  need(rows.rows.length===3 && rows.rows[0].n==='0' &&
       rows.rows[2].block_hash.toLowerCase()===expected,
       'PostgreSQL durable blocks are not canonical shared 420 ledger');
  const transactions=await db.query(
    'select tx_hash,block_hash from idx_transactions where chain_id=$1',['420']);
  const receipts=await db.query(
    'select tx_hash,block_hash from idx_receipts where chain_id=$1',['420']);
  need(transactions.rows.length===1 && receipts.rows.length===1 &&
       transactions.rows[0].tx_hash.toLowerCase()===walletHash &&
       receipts.rows[0].tx_hash.toLowerCase()===walletHash &&
       transactions.rows[0].block_hash.toLowerCase()===expected &&
       receipts.rows[0].block_hash.toLowerCase()===expected,
       'PostgreSQL omitted or duplicated real signed wallet transaction/receipt');
  const replay=await ingestor(db).runOnce();
  need(replay.processed===0,'PostgreSQL replay changed canonical history');
  const http=createIndexerHttpServer420(new IndexerPublicApiAdapter420(
       new IndexerQueryService420(db),{mode:'head'}));
  http.listen(0,'127.0.0.1');
  await once(http,'listening');
  const address='http://127.0.0.1:'+http.address().port;
  async function get(uri){const r=await fetch(address+uri);return {status:r.status,value:await r.json()};}
  try{
    const [ready,wrong,block]=await Promise.all([
      get('/ready?chainId=420'),get('/ready?chainId=31337'),
      get('/v1/blocks/2?chainId=420')]);
    need(ready.status===200 && ready.value.data.ready &&
         wrong.status===503 && !wrong.value.data.ready &&
         block.status===200 && block.value.data.hash.toLowerCase()===expected,
         'real PostgreSQL Indexer HTTP wrong-chain/consensus block isolation failed');
  }finally{await new Promise(resolve=>http.close(resolve));}
  await db.close();
  db=new PostgresSql420({connectionString:dsn,options:'-c search_path='+schema});
  const persisted=await new SqlCheckpointStore420(db,420n).load();
  need(persisted?.blockHash.toLowerCase()===expected &&
       (await ingestor(db).runOnce()).processed===0,
       'PostgreSQL process restart lost actual execution checkpoint');
  const report={
    schema:'GOV_PRE_08_REAL_POSTGRES_INDEXER_SHARED_NODE420_CHAIN420_V1',
    sourceGitHead:graph.sourceGitHead,chainId:420,
    genesisHash:first.hash,certifiedBlockHash:expected,
    realProductionIndexerModules:true,realPostgres16:true,
    coldIngestedBlocks:result.processed,durableCheckpoint:true,
    sameNode420ExecutionSource:true,wrongChainRejected:true,
    durableRestartIdempotent:true,postGenesisNormalEvmTransactionCount:transactions.rows.length,
    actualWalletSignedTxHash:walletHash,
    nativeEngineLogAuthority:'certified Go Indexer only; never assigned synthetic Ethereum txHash',
    nativeLogPostgresProjectionQualified:false,
    approvedV4:false,liveTestnetVerified:false
  };
  await fs.writeFile(opt('output'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log('GOV_PRE_08_REAL_NODE420_AND_POSTGRES420_CANONICAL_CHECKPOINT_SAME_CHAIN=PASS',expected);
}finally{
  await db.close();
  await admin.close();
}
