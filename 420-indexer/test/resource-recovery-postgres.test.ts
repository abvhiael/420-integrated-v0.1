import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AbiCoder, Interface, id, keccak256 } from 'ethers';
import { createResourceIndexer420, verifyResourceIndexerDeployment420, resourceEventArtifacts420, type ResourceIndexerPins420 } from '../src/resource-indexer.js';
import { PostgresSql420 } from '../src/postgres.js';
import { CoreProjectionConsumer420, type SqlExecutor420 } from '../src/core-projections.js';
import { ProtocolProjection420 } from '../src/protocol-projections.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { SqlCheckpointStore420 } from '../src/recovery-store.js';
import type { ChainSource420, Hex, IndexerBlock, IndexerLog, IndexerReceipt, IndexerTransaction, LogFilter420 } from '../src/chain-source.js';

const h=(n:number):Hex=>('0x'+n.toString(16).padStart(64,'0')) as Hex;
const a=(n:number):Hex=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const names=['CapabilityRegistry420','GovernanceTimelock','ResourceAuthorization420','ResourcePolicyRegistry420','ResourceProviderRegistry420','ResourceProviderCollateral420','VaultRegistry420','VaultAccounting420','AssetVault420','ResourceNodeRegistry420','ResourceOfferRegistry420','ResourceSessionRegistry420','ResourceReceiptRegistry420','ResourceRouter420','StorageProofSchemeRegistry420','StorageCapacityRegistry420','StorageCommitmentRegistry420','StorageProofRegistry420','StorageAgreementRegistry420','StorageObjectManifestRegistry420','StorageSettlementRegistry420'] as const;
const addresses=Object.fromEntries(names.map((n,i)=>[n,a(n==='GovernanceTimelock'?0x429:100+i)])) as ResourceIndexerPins420['addresses'];
const registry=a(0x434);
const code=new Map<string,Hex>([[registry,'0x6000'],...names.map((n,i)=>[addresses[n],('0x60'+(i+1).toString(16).padStart(2,'0')) as Hex] as [string,Hex])]);
const hashes=Object.fromEntries(names.map(n=>[n,keccak256(code.get(addresses[n])!) as Hex])) as ResourceIndexerPins420['runtimeHashes'];
const root=keccak256(AbiCoder.defaultAbiCoder().encode([...names.map(()=> 'address'),...names.slice(2).map(()=> 'bytes32')],[...names.map(n=>addresses[n]),...names.slice(2).map(n=>hashes[n])]));
const pins:ResourceIndexerPins420={chainId:420n,genesisHash:h(1),deploymentBlock:1n,deploymentBlockHash:h(1001),registryCodeHash:keccak256(code.get(registry)!) as Hex,addresses,runtimeHashes:hashes};
const bindings:Record<string,Record<string,Hex>>={
 [addresses.ResourceRouter420]:{nodes:addresses.ResourceNodeRegistry420,policy:addresses.ResourcePolicyRegistry420,offers:addresses.ResourceOfferRegistry420},
 [addresses.ResourceNodeRegistry420]:{providers:addresses.ResourceProviderRegistry420},
 [addresses.ResourceProviderRegistry420]:{collateral:addresses.ResourceProviderCollateral420,collateralCodeHash:hashes.ResourceProviderCollateral420},
 [addresses.ResourceProviderCollateral420]:{providers:addresses.ResourceProviderRegistry420,vault:addresses.AssetVault420,registry:addresses.VaultRegistry420,accounting:addresses.VaultAccounting420},
 [addresses.ResourceSessionRegistry420]:{offers:addresses.ResourceOfferRegistry420},
 [addresses.StorageCapacityRegistry420]:{providers:addresses.ResourceProviderRegistry420},
 [addresses.StorageCommitmentRegistry420]:{providers:addresses.ResourceProviderRegistry420},
 [addresses.StorageAgreementRegistry420]:{providers:addresses.ResourceProviderRegistry420,commitments:addresses.StorageCommitmentRegistry420,capacity:addresses.StorageCapacityRegistry420,settlementController:addresses.StorageSettlementRegistry420},
 [addresses.StorageSettlementRegistry420]:{agreements:addresses.StorageAgreementRegistry420,proofs:addresses.StorageProofRegistry420}
};
const abi=new Interface(['function getService(bytes32) view returns (address,bytes32,bytes32,uint32,uint64,bool)','function resolveActive(bytes32) view returns (address,uint32)','function getRegistrationProfile(bytes32,uint32) view returns (uint8,bytes32,bytes32,bytes32)',...new Set(Object.values(bindings).flatMap(b=>Object.keys(b)).map(n=>'function '+n+'() view returns ('+(n==='collateralCodeHash'?'bytes32':'address')+')'))]);
const artifacts=await resourceEventArtifacts420();
const interfaces=new Map([...artifacts].map(([n,v])=>[n,new Interface(v.abi as ConstructorParameters<typeof Interface>[0])]));
const position=h(500),provider=h(501),penalty=h(502),reservation=h(503),owner=a(700),amount=(1n<<255n)+123n;
class ResourceChain implements ChainSource420{
 readonly sourceId='resource-8a2-recovery-fixture';
 head=7n;fork=false;duplicate=false;wrongCode=false;wrongBinding=false;wrongGenesis=false;wrongRoot=false;wrongChain=false;missingAt=0;badReceipt=false;fabricate=false;malformed=false;
 async chainId(){return this.wrongChain?421n:420n;}
 async blockNumber(){return this.head;}
 blockHash(n:number){return n===0?(this.wrongGenesis?h(99):h(1)):h(1000+n+(this.fork&&n>=6?1000:0));}
 async getBlockByNumber(n:bigint):Promise<IndexerBlock|null>{if(n<0n||n>this.head)return null;return {number:n,hash:this.blockHash(Number(n)),parentHash:n===0n?h(0):this.blockHash(Number(n)-1),timestamp:100n+n};}
 async getBlockByHash(hash:Hex){for(let n=0n;n<=this.head;n++){const b=await this.getBlockByNumber(n);if(b?.hash===hash)return b;}return null;}
 async getCode(address:Hex){return this.wrongCode&&address===addresses.ResourceProviderCollateral420?'0x60ff' as Hex:code.get(address)??'0x';}
 async call(request:{to:Hex;data:Hex}){const p=abi.parseTransaction({data:request.data});if(!p)throw Error('unknown call');let values:unknown[];
 switch(p.name){
 case 'getService':values=[addresses.ResourceRouter420,hashes.ResourceRouter420,id('420/RESOURCE/RELEASE/METADATA/V1'),1,1,true];break;
 case 'resolveActive':values=[addresses.ResourceRouter420,1];break;
 case 'getRegistrationProfile':values=[3,id('420/RESOURCE/AUDIT-8/DEPLOYMENT-PACKAGE/V1'),this.wrongRoot?h(999):root,id('420/RESOURCE/RESOURCE_ROUTER/INTERFACE/V1')];break;
 default:{const v=bindings[request.to]?.[p.name];if(!v)throw Error('unknown binding '+p.name);values=[this.wrongBinding&&p.name==='collateral'?a(999):v];}
 }
 return abi.encodeFunctionResult(p.name,values) as Hex;}
 raw(n:number):IndexerLog[]{
 const c='ResourceProviderCollateral420',p='ResourceProviderRegistry420',s='StorageAgreementRegistry420',t='StorageSettlementRegistry420';
 const rows:Record<number,[keyof typeof addresses,string,unknown[]][]>={
 1:[[c,'CollateralDeposited',[position,provider,owner,h(504),amount]],[p,'CollateralPolicyPublished',[1,h(505),h(506)]]],
 2:[[c,'ExposureReserved',[reservation,position,addresses.StorageAgreementRegistry420,100n,1]]],
 3:[[c,'PenaltyHeld',[penalty,position,12n]],[p,'ProviderDisciplineChanged',[provider,true]]],
 4:[[c,'PenaltyAuthorized',[penalty,h(507),owner]]],
 5:[[c,'CollateralExitRequested',[position,1,1000n]]],
 6:[[c,'PenaltyExecuted',[penalty,position,this.fork?7n:12n,this.fork?7n:12n]],[s,'AgreementCollateralReleased',[h(508)]],[c,'ExposureReleased',[reservation,position]]],
 7:[[t,'StorageSettlementCompleted',[h(509),100n,0n]],[c,'CollateralWithdrawn',[position,1,this.fork?amount-7n:amount-12n]],[c,'ExitCompleted',[position,owner,this.fork?amount-7n:amount-12n]]]
 };
 return (rows[n]??[]).map(([name,event,vals],i)=>{const iface=interfaces.get(name)!;const enc=iface.encodeEventLog(iface.getEvent(event)!,vals);return {address:addresses[name],blockNumber:BigInt(n),blockHash:this.blockHash(n),transactionHash:h(3000+n),transactionIndex:0,logIndex:i,topics:enc.topics as Hex[],data:this.malformed&&n===6?(enc.data+'00') as Hex:enc.data as Hex};});
 }
 tx(n:number):IndexerTransaction{return {hash:h(3000+n),blockHash:this.blockHash(n),blockNumber:BigInt(n),transactionIndex:0,from:owner,to:addresses.ResourceProviderCollateral420,input:'0x',value:0n};}
 async getBlockTransactionsByNumber(n:bigint){return n>0n&&n<=this.head?[this.tx(Number(n))]:[];}
 async getTransactionByHash(hash:Hex){const n=Number(BigInt(hash))-3000;return n>0&&n<=Number(this.head)?this.tx(n):null;}
 async getTransactionReceipt(hash:Hex):Promise<IndexerReceipt|null>{const tx=await this.getTransactionByHash(hash);if(!tx)return null;return {transactionHash:hash,blockHash:this.badReceipt?h(999):tx.blockHash,blockNumber:tx.blockNumber,transactionIndex:0,status:1,contractAddress:null,logs:this.raw(Number(tx.blockNumber))};}
 async getLogs(filter:LogFilter420){let logs:IndexerLog[]=[];for(let n=filter.fromBlock;n<=filter.toBlock;n++){if(Number(n)!==this.missingAt)logs.push(...this.raw(Number(n)));}if(this.fabricate&&logs[0])logs.push({...logs[0],logIndex:999});if(this.duplicate)logs=[...logs,...logs];if(logs[0])logs.push({...logs[0],address:a(999),logIndex:998});return logs;}
}
test('Resource deployment verifies complete registry graph and rejects incorrect authority',async()=>{
 await verifyResourceIndexerDeployment420(new ResourceChain(),pins);
 for(const key of ['wrongCode','wrongBinding','wrongGenesis','wrongRoot','wrongChain'] as const){const s=new ResourceChain();s[key]=true;await assert.rejects(verifyResourceIndexerDeployment420(s,pins),/Resource:/);}
});
const databaseUrl=process.env.INDEXER_PG_URL;
class FaultDb extends PostgresSql420{
 interrupt=false;
 override async transaction<T>(work:(tx:SqlExecutor420)=>Promise<T>):Promise<T>{return super.transaction(tx=>work({query:async(sql,params)=>{if(this.interrupt&&sql.includes('insert into idx_checkpoints'))throw Error('injected checkpoint interruption');return tx.query(sql,params);}}));}
}
test('Resource durable PostgreSQL ingestion, receipt reconciliation, restart, rollback and canonical rebuild',{skip:!databaseUrl,timeout:90000},async t=>{
 const admin=new PostgresSql420({connectionString:databaseUrl});await admin.query('drop schema if exists resource_8a2_recovery cascade; create schema resource_8a2_recovery');await admin.close();
 const db=new FaultDb({connectionString:databaseUrl,options:'-c search_path=resource_8a2_recovery'});t.after(()=>db.close());
 for(const name of ['001-core-projections.sql','003-genesis-projections.sql','007-durable-recovery.sql','008-finalized-recovery.sql'])await db.query(await readFile(new URL('../sql/'+name,import.meta.url),'utf8'));
 const source=new ResourceChain();
 const start=()=>createResourceIndexer420(source,db,pins,{finality:{mode:'head'},startBlock:1n,maxReorgDepth:6});
 const rows=async()=>((await db.query("select block_number::text,block_hash,tx_hash,tx_index,log_index,contract_address,event_name,fields from idx_protocol_events where chain_id=420 and protocol='420Resource' order by block_number,tx_index,log_index")) as {rows:Record<string,unknown>[]}).rows;
 const cp=()=>new SqlCheckpointStore420(db,420n).load();
 source.head=3n;source.duplicate=true;assert.equal((await (await start()).runOnce()).processed,3);
 assert.equal((await rows()).length,5);assert.equal((await cp())?.blockNumber,3n);
 assert.equal(((await rows())[0]!.fields as Record<string,unknown>).amount,amount.toString());
 source.head=7n;db.interrupt=true;await assert.rejects((await start()).runOnce(),/injected checkpoint/);assert.equal((await cp())?.blockNumber,3n);assert.equal((await rows()).length,5);db.interrupt=false;
 await (await start()).runOnce();const original=await rows();assert.equal(original.length,13);assert.equal((await (await start()).runOnce()).processed,0);
 source.fork=true;source.missingAt=6;await assert.rejects((await start()).runOnce(),/omitted canonical receipt/);assert.equal((await cp())?.blockNumber,5n);
 const ancestor=await rows();assert.equal(ancestor.length,7);
 source.missingAt=0;source.badReceipt=true;await assert.rejects((await start()).runOnce(),/receipt provenance/);assert.deepEqual(await rows(),ancestor);
 source.badReceipt=false;source.fabricate=true;await assert.rejects((await start()).runOnce(),/fabricated canonical/);assert.deepEqual(await rows(),ancestor);
 source.fabricate=false;source.malformed=true;await assert.rejects((await start()).runOnce(),/malformed/);assert.deepEqual(await rows(),ancestor);
 source.malformed=false;await (await start()).runOnce();const replay=await rows();assert.equal(replay.length,13);assert.notDeepEqual(replay,original);
 await new CoreProjectionConsumer420(db,new ProtocolProjection420(db,new ProtocolDecoderRegistry420()),420n).rollbackDurably(null,null);
 assert.equal((await rows()).length,0);await (await start()).runOnce();assert.deepEqual(await rows(),replay);
});
