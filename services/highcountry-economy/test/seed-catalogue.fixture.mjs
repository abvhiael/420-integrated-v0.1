import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import {MemoryTransactionFixture,SettlementError} from '../src/buds-ledger.js';
import {RuntimeAuthority} from '../src/runtime-integration.js';
import {SeedCatalogue,SeedCollection} from '../src/seed-catalogue.js';
import {SeedChainReader,parseSeedBreedingPlan,canonicalSeedChild} from '../src/seed-chain-reader.js';
import {keccak256,selector} from '../src/keccak.js';
import {word} from '../src/finalized-rpc.js';
const d=new URL('../../../deployments/highcountry/',import.meta.url);
const load=async n=>JSON.parse(await readFile(new URL(n,d),'utf8'));
export const data={catalog:await load('seed-catalog.v1.json'),research:await load('common-cultivar-research.v1.json'),rarePairs:await load('rare-parent-pairs.v1.json'),founders:await load('original-sixteen-archive.v1.json'),commonReferences:await load('common-reference-genomes.v1.json'),rarePlan:parseSeedBreedingPlan(await readFile(new URL('rare-breeding-plan.v1.json',d),'utf8'))};
export const ALICE='0x'+'11'.repeat(20),BOB='0x'+'22'.repeat(20),HASH='0x'+'aa'.repeat(32);
const hash=s=>keccak256(Buffer.from(s));
export function chainFixture(){
 const names=['seeds','genomes','plants','harvest','cultivation','breeding','breedingRandomness','randomRouter'];
 const code='0x6000',codeHash=keccak256(Buffer.from('6000','hex'));
 const contracts=Object.fromEntries(names.map((n,i)=>[n,{address:'0x'+(i+1).toString(16).padStart(40,'0'),codeHash}]));
 const rare=data.rarePlan.events[0],entropy=hash('seed05-rare-entropy'),requestId=hash('seed05-request'),proof=hash('seed05-proof');
 const founder=data.founders.founders[0],founderGenome=hash('seed05-founder'),founderLine=hash('HC.FOUNDING.GENETIC_LINE.'+founder.index);
 const ref=data.commonReferences.genomes.find(e=>e.cultivarId==='HC-C-blue-dream');
 const state={owner:ALICE,quantity:5,remaining:3,grower:ALICE,grams:200,grade:3,badCode:false,reorg:false,omitLogs:false,referenceTampered:false,seedGenome:ref.genomeId,harvestGenome:ref.genomeId,badRare:false,badProof:false,badLoci:false,badFounder:false,calls:[]};
 const encoded=(...values)=>'0x'+values.map(x=>word(x)).join('');
 const rpc={chainId:420,contracts,header:async()=>({number:'0x64',hash:HASH}),request:async(method,params)=>{
  state.calls.push([method,params]);
  if(method==='eth_getCode')return state.badCode?'0x':code;
  if(method==='eth_getBlockByNumber')return {hash:state.reorg?'0x'+'bb'.repeat(32):HASH,number:'0x64'};
  if(method==='eth_getLogs'){
   const f=params[0];if(state.omitLogs||f.topics[0]!==hash('SeedLotRegistered(uint64,bytes32,address,uint32,uint64)')||f.topics[3]!=='0x'+word(ALICE))return [];
   return [{address:contracts.seeds.address,topics:[f.topics[0],'0x'+word(1),ref.genomeId,'0x'+word(ALICE)],blockNumber:'0x64',blockHash:HASH,transactionHash:'0x'+'cc'.repeat(32),removed:false}];
  }
  if(method!=='eth_call')throw Error('unexpected RPC '+method);
  const [{to,data:call}]=params,name=names.find(n=>contracts[n].address===to),sig=call.slice(2,10);
  const matches=s=>sig===selector(s);
  const dep=(s,target)=>matches(s)?encoded(contracts[target].address):null;
  for(const [s,target] of (name==='seeds'?[['genomeRegistry()','genomes']]:name==='plants'?[['genomeRegistry()','genomes']]:name==='harvest'?[['plantRegistry()','plants'],['cultivationEngine()','cultivation']]:name==='cultivation'?[['plantRegistry()','plants']]:name==='breeding'?[['genomeRegistry()','genomes'],['randomness()','breedingRandomness']]:name==='breedingRandomness'?[['breedingEngine()','breeding'],['router()','randomRouter']]:[])){const v=dep(s,target);if(v)return v;}
  if(matches('getSeedLot(uint64)'))return encoded(1,state.seedGenome,0,state.owner,state.quantity,hash('metadata'),1);
  if(matches('remainingQuantity(uint64)'))return encoded(state.remaining);
  if(matches('getGenome(bytes32)')){
   const gid='0x'+call.slice(10,74),e=data.commonReferences.genomes.find(e=>e.genomeId===gid);
   if(gid===rare.childGenomeId){const pa=data.commonReferences.genomes.find(x=>x.genomeId===rare.parentAGenomeId),pb=data.commonReferences.genomes.find(x=>x.genomeId===rare.parentBGenomeId),loci=canonicalSeedChild(pa.loci,pb.loci,entropy,rare.breedingEventId);if(state.badLoci)loci[0]=hash('forged');return encoded(gid,rare.childLineId,rare.metadataHash,...loci,0,1);}
   if(gid===founderGenome)return encoded(gid,founderLine,hash('founder-meta'),...Array(28).fill(hash('founder-locus')),1,1);
   if(!e)throw new SettlementError('unknown fixture genome');
   return encoded(e.genomeId,e.lineId,state.referenceTampered?hash('wrong'):e.metadataHash,...e.loci,0,1);
  }
  if(matches('foundingGenomeOfLine(bytes32)'))return encoded(state.badFounder?hash('wrong-founder'):founderGenome);
  if(matches('getBreedingEvent(uint64)'))return encoded(rare.breedingEventId,rare.parentAGenomeId,rare.parentBGenomeId,rare.childGenomeId,rare.childLineId,rare.metadataHash,state.badRare?hash('wrong-context'):rare.contextHash,rare.localRequestId,entropy,1,1);
  if(matches('pending(bytes32)'))return encoded(requestId,hash('HC.RANDOM.BREEDING.V1'),rare.contextHash,0,1);
  if(matches('profileId()'))return encoded(1);
  if(matches('request(bytes32)')){const out=Array(21).fill(0);out[0]=contracts.breedingRandomness.address;out[1]=1;out[3]=hash('HC.RANDOM.BREEDING.V1');out[4]=rare.contextHash;out[20]=state.badProof?2:3;return encoded(...out);}
  if(matches('result(bytes32)'))return encoded(entropy,proof);
  if(matches('getHarvest(uint64)'))return encoded(7,state.harvestGenome,hash('expression'),hash('rule'),hash('rule-content'),state.grower,1,0,1000,1);
  if(matches('getHarvestScore(uint64)'))return encoded(state.grams,9000,10000,state.grade);
  if(matches('getPlant(uint64)'))return encoded(7,state.harvestGenome,state.grower,1,1,6,1,1000,1);
  throw Error('unimplemented fixture '+name+' '+sig);
 }};
 return {rpc,state,rare,founder,founderGenome,reader:new SeedChainReader({rpc,...data,deploymentBlock:100,logChunk:100})};
}
export async function fixture({store=new MemoryTransactionFixture(),reader}={}){
 const keys=generateKeyPairSync('ed25519'),game='0x'+'44'.repeat(32);let now=1000;
 const identity=new RuntimeAuthority({store,issuers:{idp:{publicKey:keys.publicKey}},audience:'hc',gameId:game,chainId:420,origin:'https://hc.example',rpc:{playerProfile:async()=>game},clock:()=>now});
 const token=principal=>{const payload=Buffer.from(JSON.stringify({iss:'idp',sub:principal,sid:'session-'+principal,aud:'hc',game,nbf:0,exp:100000,epoch:0})).toString('base64url');return payload+'.'+sign(null,Buffer.from(payload),keys.privateKey).toString('base64url');};
 const alice=token('alice'),bob=token('bob');await identity.register(alice);await identity.register(bob);
 await store.transact(s=>{s.runtimeWallets.set('alice',{wallet:ALICE,profile:game,chainId:420,game});s.runtimeWallets.set('bob',{wallet:BOB,profile:game,chainId:420,game});});
 const chain=chainFixture(),catalogue=new SeedCatalogue(data);
 const service=new SeedCollection({store,identity,catalogue,reader:reader??chain.reader,clock:()=>now});
 return {service,store,identity,token,alice,bob,chain,catalogue,clock:v=>now=v};
}
