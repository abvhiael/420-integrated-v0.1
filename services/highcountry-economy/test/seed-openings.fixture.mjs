import {fixture,data,ALICE} from './seed-catalogue.fixture.mjs';
import {SeedPacks} from '../src/seed-packs.js';
import {SeedOpenings} from '../src/seed-openings.js';
import {SeedOpeningChainReader} from '../src/seed-opening-chain-reader.js';
import {SeedOpeningWorker} from '../src/seed-opening-worker.js';
import {seedHash,OPENING_POLICY_HASH,poolDefinition,OPENING_POOLS,selectSeedOutcome,OPENING_DOMAIN} from '../src/seed-opening-selection.js';
import {word} from '../src/finalized-rpc.js';
import {selector} from '../src/keccak.js';
export async function openingFixture(options={}){
 const f=await fixture(options);f.identity.issuers.idp.operators={alice:{sources:['seed-packs']}};
 const pins=structuredClone(f.chain.rpc.contracts),code='0x6000',codeHash=seedHash(Buffer.from('6000','hex'));
 // seedHash hashes bytes as supplied; all addresses below are explicit test transport fixtures.
 pins.seedOpening={address:'0x'+'90'.repeat(20),codeHash};pins.emergency={address:'0x'+'91'.repeat(20),codeHash};
 const profile=seedHash('SEED08.TEST_ONLY.PROFILE'),route={routeId:seedHash('SEED08.TEST_ONLY.ROUTE'),revision:1,operator:ALICE,verifier:'0x'+'92'.repeat(20),verifierCodeHash:codeHash,methodId:seedHash('420.RANDOM.METHOD.EXTERNAL_VRF.V1')};
 const state={records:new Map(),calls:[],submissions:[],badCode:false,reorg:false,badProof:false,badPurpose:false,badIndex:false,persistent:true,hideResponse:false,receipt:null,transaction:null};
 const encoded=(...args)=>'0x'+args.map(word).join(''),getRecord=id=>[...state.records.values()].find(r=>r.requestId===id);
 const rpc={chainId:420,contracts:pins,unrestricted:async()=>true,header:async()=>({number:'0x64',hash:'0x'+'aa'.repeat(32)}),request:async(method,args)=>{
  state.calls.push([method,args]);if(method==='eth_chainId')return '0x1a4';if(method==='eth_getCode')return state.badCode?'0x':code;
  if(method==='eth_getBlockByNumber')return {number:args[0],hash:'0x'+(state.reorg?'bb':'aa').repeat(32)};
  if(method==='eth_getTransactionReceipt')return state.receipt;if(method==='eth_getTransactionByHash')return state.transaction;
  if(method!=='eth_call')throw Error('unexpected opening RPC '+method);
  const [tx]=args,sig=tx.data.slice(2,10),values=tx.data.slice(10).match(/.{64}/g)??[],is=name=>sig===selector(name);
  const scalar={'router()':pins.randomRouter.address,'emergencyState()':pins.emergency.address,'gameId()':f.identity.gameId,'policyHash()':OPENING_POLICY_HASH,'profileId()':profile,'timeoutSeconds()':100};
  for(const [name,value] of Object.entries(scalar))if(is(name))return encoded(value);
  if(is('poolHash(uint8)'))return encoded(poolDefinition(f.catalogue,OPENING_POOLS[Number(BigInt('0x'+values[0]))]).hash);
  if(is('poolSize(uint8,uint8)'))return encoded(poolDefinition(f.catalogue,OPENING_POOLS[Number(BigInt('0x'+values[0]))]).tiers[Number(BigInt('0x'+values[1]))].length);
  if(is('getOpening(bytes32)')){const r=state.records.get('0x'+values[0]);if(!r)return encoded(...Array(9).fill(0));const o=r.intent,selection=selectSeedOutcome(poolDefinition(f.catalogue,OPENING_POOLS[o.pool]),r.entropy,r.requestId);return encoded(o.commitment,o.wallet,o.pool,r.requestId,r.fulfilled?selection.tierIndex:0,r.fulfilled?(state.badIndex?99:selection.index):0,r.fulfilled?r.entropy:0,r.fulfilled?r.proofHash:0,r.fulfilled?1:0);}
  if(is('persistentRequest(bytes32)'))return encoded(state.persistent?1:0);
  if(is('request(bytes32)')){const r=getRecord('0x'+values[0]);if(!r)throw Error('missing test request');const v=Array(21).fill(0);Object.assign(v,{0:pins.seedOpening.address,1:profile,2:1,3:OPENING_DOMAIN,4:state.badPurpose?seedHash('wrong'):r.intent.purpose,5:route.routeId,7:1,9:route.operator,11:route.verifier,13:route.methodId,15:1000,16:1100,17:1100,18:2,19:0,20:r.routerReady?3:1});return encoded(...v);}
  if(is('result(bytes32)')){const r=getRecord('0x'+values[0]);return encoded(r.entropy,state.badProof?0:r.proofHash);}
  if(is('requestOpening(bytes32,address,uint8,bytes32)')||is('fulfillOpening(bytes32)'))return '0x';
  throw Error('unknown opening ABI '+sig);
 }};
 const reader=new SeedOpeningChainReader({rpc,catalogue:f.catalogue,gameId:f.identity.gameId,profileId:profile,timeoutSeconds:100,approvedRoutes:[route]});
 const genomeReader={cultivar:async cid=>{const c=f.catalogue.detail(cid),common=data.commonReferences.genomes.find(g=>g.cultivarId===cid),rare=data.rarePlan.events.find(g=>g.cultivarId===cid);return {cultivarId:cid,genomeId:common?.genomeId??rare?.childGenomeId??seedHash('TEST_FOUNDER:'+cid),basis:c.tier==='common'?'registered-common-reference':c.tier==='rare'?'finalized-canonical-breeding':'registered-founding-line',...(rare?{breedingEventId:rare.breedingEventId}:{}),anchor:{fixtureOnly:true}};},issuedLot:async()=>{throw Error('not finalized in unit fixture');}};
 const packs=new SeedPacks({...f,reader:genomeReader}),openings=new SeedOpenings({packs,reader,clock:()=>1000});
 const signerRpc={request:async(method,args)=>{
  if(method==='eth_chainId')return '0x1a4';if(method!=='eth_sendTransaction')throw Error('unexpected signer method');const tx=args[0],key='0x'+tx.data.slice(10,74);state.submissions.push(tx);
  if(tx.data.slice(2,10)===selector('requestOpening(bytes32,address,uint8,bytes32)')){
   const intent=await f.store.transact(s=>structuredClone([...s.seedOpenings.values()].find(i=>i.openingKey===key)));
   if(!state.records.has(key)){const requestId=seedHash('TEST_REQUEST:'+key);state.records.set(key,{intent,requestId,entropy:seedHash('TEST_ROOT:'+requestId),proofHash:seedHash('TEST_PROOF:'+requestId),routerReady:false,fulfilled:false});}
  }else{const r=state.records.get(key);if(!r?.routerReady)throw Error('proof absent');r.fulfilled=true;}
  if(state.hideResponse)throw Error('broadcast response lost');return seedHash('TEST_TX:'+state.submissions.length);
 }};
 const worker=new SeedOpeningWorker({openings,signerRpc,operator:ALICE,clock:()=>1000});
 const allocate=async(region='World',owner='alice',count=1,receiptId='receipt:opening')=>packs.allocate(f.alice,{receiptId,region,owner,count});
 return {...f,packs,openings,reader,worker,rpc,state,allocate,genomeReader,route,profile,prove:key=>{const r=state.records.get(key);if(!r)throw Error('no request');r.routerReady=true;}};
}
