#!/usr/bin/env node
// GOV-PRE-08 Step3: actual 420Indexer source/decoder/projection against the
// mined 14-component local Anvil graph, with *in-memory transactional SQL*.
// This is NOT a running Postgres/indexer service nor a production Explorer.
// It qualifies exact RPC and decoder wiring, unique event identity, projection
// upsert, rollback, read-model reconstruction and local chain isolation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const requireIndexer=createRequire(path.join(root,'420-indexer','package.json'));
const { id }=requireIndexer('ethers');
const { HttpJsonRpcTransport420,EvmJsonRpcSource420 } =
    await import('../../420-indexer/dist/src/rpc-source.js');
const { ProtocolDecoderRegistry420 } =
    await import('../../420-indexer/dist/src/protocol-decoder.js');
const { ProtocolProjection420 } =
    await import('../../420-indexer/dist/src/protocol-projections.js');
function need(value,msg) {
  if (!value) throw new Error('GOV-PRE-08 STEP3 Indexer: '+msg);
}
function canonical(value) {
  return JSON.stringify(value,(_key,v)=>typeof v==='bigint'?v.toString():v,Object.keys(value).sort());
}
function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function writeNew(filename,value) {
  need(!fs.existsSync(filename),'refusing overwrite of canonical read-model output');
  fs.writeFileSync(filename,JSON.stringify(value,null,2)+'\n');
}
const args=process.argv.slice(2);
function flag(name) {
  const i=args.indexOf(name);
  need(i>=0 && args[i+1],name+' is required');
  return args[i+1];
}
const url=flag('--rpc'), graphPath=flag('--graph'), out=flag('--output');
need(/^http:\/\/127\.0\.0\.1:\d{3,5}$/.test(url),'loopback-only source');
const graph=JSON.parse(fs.readFileSync(graphPath,'utf8'));
need(graph.schema==='GOV_PRE_08_STEP3_LOCAL_ACTUAL_FOURTEEN_CONSTRUCTORS_V1' &&
     graph.chainId===31337 && graph.approvedV4===false,'unapproved local graph only');
const transport=new HttpJsonRpcTransport420(url);
const source=new EvmJsonRpcSource420(transport,'gov-pre-08-local');
need(await source.chainId()===31337n,'unexpected onchain network identity');
const tip=await source.blockNumber();
need(tip>=18n,'actual mined Genesis and founder graph absent');

const candidates=[
  ['ProtocolRegistry','420Registry','0x0000000000000000000000000000000000000434',
   ['ComponentRegistered','ServiceVersionPublished','ServiceRegistrationProfilePublished']],
  ['TreasuryPolicyRegistry420','420Treasury',
   graph.actualProductionConstructorAddresses.TreasuryPolicyRegistry420,
   ['AssetPolicySet']],
  ['TreasuryBudgetRegistry420','420Treasury',
   graph.actualProductionConstructorAddresses.TreasuryBudgetRegistry420,
   ['ControllerSet','BudgetCreated']],
  ['FoundingWalletClaims420','420Governance',
   graph.actualProductionConstructorAddresses.FoundingWalletClaims420,
   ['FounderWalletClaimed']],
  ['FoundingDeveloperCompensationSplitter420','420Treasury',
   graph.actualProductionConstructorAddresses.FoundingDeveloperCompensationSplitter420,
   ['CompensationVaultBound']],
  ['FoundingTreasuryAuthority420','420Treasury',
   graph.actualProductionConstructorAddresses.FoundingTreasuryAuthority420,
   ['FoundingReleaseExecutorBound']],
  ['CommunityValidatorReserve','420Stake','0x0000000000000000000000000000000000000425',
   ['GenesisFoundingSponsorAuthorityBound','ValidatorRegistryBound']],
  ['ValidatorRegistry','420Stake','0x0000000000000000000000000000000000000423',
   ['CommunityValidatorReserveBound']],
];
const TYPES=new Set(['bytes4','bytes8','bytes16','bytes32','address','bool',
    'uint8','uint16','uint32','uint64','uint128','uint256','int256']);
const descriptors=[];
for (const [contract,protocol,address,wanted] of candidates) {
  need(/^0x[0-9a-fA-F]{40}$/.test(address),'bad deployment '+contract);
  const file=path.join(root,'contracts','out',contract+'.sol',contract+'.json');
  const artifact=JSON.parse(fs.readFileSync(file,'utf8'));
  for (const name of wanted) {
    const matching=artifact.abi.filter(item=>item.type==='event' && item.name===name);
    need(matching.length===1 && !matching[0].anonymous,
      'missing expected true compiled ABI event: '+contract+'.'+name);
    const abi=matching[0];
    need(abi.inputs.every(x=>TYPES.has(x.type)),
         'event descriptor uses unsupported topic type '+contract+'.'+name);
    const signature=name+'('+abi.inputs.map(x=>x.type).join(',')+')';
    descriptors.push({protocol,eventName:name,contractAddress:address.toLowerCase(),
      topic0:id(signature),
      fields:abi.inputs.map((x,i)=>({name:x.name||'arg'+i,kind:x.type,indexed:!!x.indexed}))});
  }
}
const descriptorsOutput=args.includes('--descriptors-output') ? flag('--descriptors-output') : null;
if (descriptorsOutput) writeNew(descriptorsOutput,{
  schema:'GOV_PRE_08_STEP3_LOCAL_ABI_BOUND_INDEXER_DESCRIPTORS_V1',
  chainId:31337, sourceGitHead:graph.sourceGitHead,
  graphSourceDigest:graph.deterministicGraphDigestSha256,
  descriptors
});
const decoders=new ProtocolDecoderRegistry420(descriptors);
const allLogs=await source.getLogs({fromBlock:0n,toBlock:tip});
need(allLogs.length>=30,'actual deployed graph produced too few mined logs');
const relevant=allLogs.filter(log=>descriptors.some(d=>d.contractAddress===log.address.toLowerCase() &&
                        d.topic0.toLowerCase()===log.topics[0]?.toLowerCase()));
need(relevant.length>=20,'actual 14-graph log source has too few supported events');
const decoded=relevant.map(x=>decoders.decode(x));
need(decoded.every(x=>x!==null),'deployed log source unexpectedly undecodable');
const byEvent=(name)=>decoded.filter(x=>x.eventName===name);
need(byEvent('ComponentRegistered').length===20,
     'actual ProtocolRegistry did not register 14 local sources plus six canonical Wallet consumer IDs');
need(byEvent('ServiceVersionPublished').length===4,
     'real canonical Registry did not publish exactly four services');
need(byEvent('FounderWalletClaimed').length===3,
     'actual 31337 founder claims failed log qualification');
need(byEvent('BudgetCreated').length===2,
     'actual two Treasury budget creation events absent');
for (const ev of byEvent('BudgetCreated')) {
  const block=await source.getBlockByNumber(ev.blockNumber);
  need(block!==null && BigInt(ev.fields.validFrom)===block.timestamp,
       'Treasury budget validFrom is not its actual canonical execution block timestamp');
}
need(byEvent('AssetPolicySet').length===1,
     'actual native $420 policy initialization event absent');
need(byEvent('GenesisFoundingSponsorAuthorityBound').length===1,
     'actual Stake sponsorship authority event absent');
// A corrupt event from another contract with a legitimate topic MUST fail closed.
const corrupt={...relevant.find(x=>x.topics.length>0),address:'0x000000000000000000000000000000000000dead'};
let wrongEmitterRejected=false;
try {decoders.decode(corrupt);} catch {wrongEmitterRejected=true;}
need(wrongEmitterRejected,'Indexer accepted spoofed registered source address');

for (const log of relevant) {
  const block=await source.getBlockByNumber(log.blockNumber);
  const receipt=await source.getTransactionReceipt(log.transactionHash);
  need(block?.hash.toLowerCase()===log.blockHash.toLowerCase() &&
       receipt?.status===1 && receipt.blockHash.toLowerCase()===log.blockHash.toLowerCase(),
       'orphaned or failed transaction wrongly accepted into Indexer projection');
}
class MemoryTransactionalSql {
  constructor() {this.rows=new Map();}
  async transaction(task) {
    const state=new Map(this.rows);
    const executor={query:async(sql,p=[])=>{
      if (/insert into idx_protocol_events/i.test(sql)) {
        const key=[p[0],p[2],p[3],p[5]].join(':');
        state.set(key,{chainId:p[0],blockNumber:BigInt(p[1]),blockHash:p[2],
          transactionHash:p[3],transactionIndex:p[4],logIndex:p[5],
          contractAddress:p[6],protocol:p[7],eventName:p[8],fields:JSON.parse(p[9])});
      } else if (/delete from idx_protocol_events where block_number/i.test(sql)) {
        for(const [k,v] of state) if(v.blockNumber>BigInt(p[0])) state.delete(k);
      } else if (/delete from idx_protocol_events/i.test(sql)) {
        state.clear();
      } else throw new Error('unexpected mock SQL operation: '+sql);
      return {rows:[],rowCount:1};
    }};
    const res=await task(executor);
    this.rows=state;
    return res;
  }
}
const sql=new MemoryTransactionalSql();
const projection=new ProtocolProjection420(sql,decoders);
need(await projection.applyLogs(31337n,relevant)===relevant.length,
     'actual source decoder projection count diverged');
need(sql.rows.size===relevant.length,'Indexer projection lost or duplicated log identities');
const snapshot=()=>[...sql.rows.values()].map(v=>({
  contractAddress:v.contractAddress,protocol:v.protocol,eventName:v.eventName,
  blockNumber:v.blockNumber.toString(),fields:v.fields
})).sort((a,b)=>Number(BigInt(a.blockNumber)-BigInt(b.blockNumber))||
             a.contractAddress.localeCompare(b.contractAddress)||
             a.eventName.localeCompare(b.eventName));
const first=snapshot();
const normalizeVerifiedBudgetTimestamp=(rows)=>rows.map(row=>
   row.eventName==='BudgetCreated'
     ? {...row,fields:{...row.fields,validFrom:'VERIFIED_CANONICAL_BUDGET_EVENT_BLOCK_TIMESTAMP'}}
     : row);
const firstHash=hash(normalizeVerifiedBudgetTimestamp(first));
need(await projection.applyLogs(31337n,relevant)===relevant.length,
     'idempotent replay rejected valid source events');
need(sql.rows.size===relevant.length && hash(normalizeVerifiedBudgetTimestamp(snapshot()))===firstHash,
     'duplicate source log replay mutated Indexed read model');
// Roll back an actual block containing a qualified protocol event, not
// merely the latest RPC blocks (which may contain unrelated native gateway
// binding receipts). This positively demonstrates event deletion/rebuild.
const lastProjectedBlock=relevant.reduce((highest,log)=>
  log.blockNumber>highest?log.blockNumber:highest,0n);
need(lastProjectedBlock>0n && lastProjectedBlock<=tip,
     'no actual qualified event block available for canonical rollback');
const cutoff=lastProjectedBlock-1n;
await projection.rollbackTo(cutoff);
need(sql.rows.size<relevant.length,'rollback did not delete reverted Indexer records');
const surviving=relevant.filter(log=>log.blockNumber<=cutoff);
const rebuilt=relevant.filter(log=>log.blockNumber>cutoff);
need(sql.rows.size===surviving.length,'rollback lost canonical historical projection');
await projection.applyLogs(31337n,rebuilt);
need(sql.rows.size===relevant.length && hash(normalizeVerifiedBudgetTimestamp(snapshot()))===firstHash,
     'Indexer reorg replay failed deterministic reconstruction');
await projection.rollbackTo(null);
need(sql.rows.size===0,'Indexer full reset failed');
await projection.applyLogs(31337n,relevant);
need(sql.rows.size===relevant.length && hash(normalizeVerifiedBudgetTimestamp(snapshot()))===firstHash,
     'Index read-model cold rebuild diverged');
const evidence={
  schema:'GOV_PRE_08_STEP3_REAL_420INDEXER_LOCAL_RPC_PROJECTION_V1',
  sourceGitHead:graph.sourceGitHead,chainId:31337,
  actualSource:'EvmJsonRpcSource420',
  actualDecoder:'ProtocolDecoderRegistry420',
  actualProjection:'ProtocolProjection420',
  sqlBackend:'IN_MEMORY_TRANSACTIONAL_SQL_NOT_POSTGRES',
  graphSourceDigest:graph.deterministicGraphDigestSha256,
  latestBlock:tip.toString(),
  sourceReceiptLogs:allLogs.length,indexedLogs:relevant.length,
  componentRegistrations:byEvent('ComponentRegistered').length,
  canonicalServicePublications:byEvent('ServiceVersionPublished').length,
  verifiedFounderClaims:byEvent('FounderWalletClaimed').length,
  budgetCreationTimesVerifiedAgainstCanonicalBlocks:true,
  crossRunTimestampNormalization:'ONLY_BudgetCreated.validFrom_AFTER_CANONICAL_BLOCK_CHECK',
  treasuryBudgets:byEvent('BudgetCreated').length,
  sourceEmittersBound:descriptors.length,
  wrongEmitterRejected:true, replayIdempotent:true,
  reorgRollbackAndRebuild:true, fullRebuild:true,
  normalizedReadModelDigest:firstHash,
  postgresQualified:false,explorerRunning:false,
  nativeStakeConsensusQualified:false,approvedV4:false
};
writeNew(out,evidence);
console.log('GOV_PRE_08_STEP3_REAL_INDEXER_RPC_DECODE_REPLAY_REORG=PASS LOCAL ONLY',
            evidence.normalizedReadModelDigest);
