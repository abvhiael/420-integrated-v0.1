import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog } from '../src/chain-source.js';
import type { Artifact420 } from '../src/abi-manifest.js';
import { TREASURY_EVENT_CONTRACTS_420, bindTreasuryDescriptors420, treasuryDescriptorsFromArtifacts420, type TreasuryArtifactManifest420, type TreasuryEventContract420 } from '../src/treasury-descriptors.js';
import { createTreasuryIndexer420 } from '../src/treasury-indexer.js';
import { PostgresSql420 } from '../src/postgres.js';
import { SqlCheckpointStore420 } from '../src/recovery-store.js';
import { treasuryBudgetState420, treasuryAssetPolicyState420, treasuryDisbursementState420 } from '../src/treasury-read-model.js';
import type { SqlExecutor420 } from '../src/core-projections.js';

const manifest = JSON.parse(readFileSync('descriptors/treasury420-v1.json','utf8')) as TreasuryArtifactManifest420;
const artifacts = new Map<string,Artifact420>(manifest.contracts.map(c=>[c.contractName,{contractName:c.contractName,abi:c.events.map(e=>({type:'event',name:e.name,anonymous:false,inputs:e.inputs}))}]));
const addresses = Object.fromEntries(TREASURY_EVENT_CONTRACTS_420.map((n,i)=>[n,'0x'+String(i+1).repeat(40)])) as Record<TreasuryEventContract420,Hex>;
const descriptors=bindTreasuryDescriptors420(treasuryDescriptorsFromArtifacts420(manifest,artifacts),addresses);
const h=(n:number):Hex=>`0x${n.toString(16).padStart(64,'0')}`;
const data=(...values:number[]):Hex=>`0x${values.map(n=>h(n).slice(2)).join('')}`;
const budget=h(11), disb=h(12), asset='0x'+'0'.repeat(40);
class Source implements ChainSource420 {
 sourceId='treasury-recovery-fixture'; head=1n; chain=420n; fork=false;
 async chainId(){return this.chain;}
 async blockNumber(){return this.head;}
 async getBlockByNumber(n:bigint):Promise<IndexerBlock|null>{
  if(n<0n||n>this.head)return null;
  const id=(v:bigint)=>Number(v)+1+(this.fork&&v>=3n?100:0);
  return {number:n,hash:h(id(n)),parentHash:n===0n?h(0):h(id(n-1n)),timestamp:100n+n};
 }
 async getBlockByHash(hash:Hex){for(let n=0n;n<=this.head;n++){const b=await this.getBlockByNumber(n);if(b?.hash===hash)return b;}return null;}
 async getTransactionByHash(){return null;}
 async getTransactionReceipt(){return null;}
 async call():Promise<Hex>{return '0x';}
 async getCode():Promise<Hex>{return '0x';}
 async getLogs(filter:{fromBlock:bigint;toBlock:bigint}):Promise<IndexerLog[]>{
  const n=filter.fromBlock,b=(await this.getBlockByNumber(n))!,logs:IndexerLog[]=[];
  const emit=(name:string,topics:Hex[],encoded:Hex)=>{
   const d=descriptors.find(x=>x.eventName===name)!;
   logs.push({address:d.contractAddress,blockHash:b.hash,blockNumber:n,transactionHash:h(Number(n)+1000),transactionIndex:0,logIndex:logs.length,topics:[d.topic0,...topics],data:encoded});
  };
  if(n===1n){emit('AssetPolicySet',[h(0)],data(1,100,500,60,1));emit('BudgetCreated',[budget,h(2),h(3)],data(0,1000,1,200,4,5));}
  if(n===2n){emit('BudgetCommitmentChanged',[budget],data(80,0));emit('DisbursementScheduled',[disb,budget,h(44)],data(0,80,2,100,4,6));}
  if(n===3n){emit('AssetPolicySet',[h(0)],data(this.fork?0:1,100,500,60,2));emit('BudgetCommitmentChanged',[budget],this.fork?data(0,0):data(80,80));if(this.fork)emit('DisbursementCancelled',[disb],data());else emit('DisbursementExecuted',[disb,h(45)],data(46));}
  return logs.flatMap(log=>[log,{...log}]);
 }
}
class FaultDB extends PostgresSql420 {
 failCheckpoint=false;
 override async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{
  return super.transaction(tx=>work({query:async(sql,params)=>{if(this.failCheckpoint&&sql.includes('insert into idx_checkpoints'))throw new Error('injected checkpoint failure');return tx.query(sql,params);}}));
 }
}
const databaseUrl=process.env.INDEXER_PG_URL;
test('Treasury durable PostgreSQL checkpoint, restart, reorganization and clean rebuild', {skip:!databaseUrl,timeout:60000},async t=>{
 const admin=new PostgresSql420({connectionString:databaseUrl});
 await admin.query('drop schema if exists treasury_recovery_rec7 cascade; create schema treasury_recovery_rec7');await admin.close();
 const open=()=>new FaultDB({connectionString:databaseUrl,options:'-c search_path=treasury_recovery_rec7'});
 let db=open();t.after(async()=>db.close());
 for(const name of ['001-core-projections.sql','003-genesis-projections.sql','007-durable-recovery.sql','008-finalized-recovery.sql']){
  await db.query(await readFile(new URL(`../sql/${name}`,import.meta.url),'utf8'));
 }
 const source=new Source();
 const ingest=()=>createTreasuryIndexer420(source,db,420n,h(1),manifest,artifacts,addresses,{finality:{mode:'head'}});
 const run=async()=> (await ingest()).runOnce();
 const states=()=>Promise.all([treasuryBudgetState420(db,420n,budget),treasuryDisbursementState420(db,420n,disb),treasuryAssetPolicyState420(db,420n,asset)]);
 await run();assert.equal((await states())[0]?.committed,'0');
 source.head=3n;db.failCheckpoint=true;await assert.rejects(run,/injected checkpoint/);
 assert.equal((await new SqlCheckpointStore420(db,420n).load())?.blockNumber,1n);
 assert.equal((await states())[1],null);
 db.failCheckpoint=false;await run();const original=await states();
 assert.equal(original[0]?.executed,'80');assert.equal(original[1]?.state,'EXECUTED');assert.equal(original[2]?.revision,'2');
 await db.close();db=open();assert.equal((await run()).processed,0);assert.deepEqual(await states(),original);
 const existing=await ingest();source.chain=421n;await assert.rejects(()=>existing.runOnce(),/chain mismatch/);source.chain=420n;
 source.fork=true;assert.equal((await run()).recoveredReorgDepth,1);const replaced=await states();
 assert.equal(replaced[0]?.committed,'0');assert.equal(replaced[1]?.state,'CANCELLED');assert.equal(replaced[1]?.vaultReleaseHash,null);assert.equal(replaced[2]?.allowed,false);
 await db.query('truncate idx_protocol_events,idx_logs,idx_receipts,idx_transactions,idx_blocks,idx_checkpoints,idx_canonical_history');
 await run();assert.deepEqual(await states(),replaced);
});
