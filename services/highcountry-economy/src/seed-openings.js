import {SettlementError} from './buds-ledger.js';
import {SEED_PACK_POLICY,seedPackState} from './seed-packs.js';
import {address,calldata} from './finalized-rpc.js';
import {seedHash,OPENING_POLICY_HASH,poolDefinition,openingKey,openingPurpose,selectSeedOutcome,openingCommitment,eligibleGenomeCommitment} from './seed-opening-selection.js';
const fail=m=>{throw new SettlementError(m);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const used=(map,key)=>{const n=map.get(key)??0;if(!Number.isSafeInteger(n)||n<0)fail('corrupt opening supply');return n;};
export function seedOpeningState(s){seedPackState(s);for(const key of ['seedOpenings','seedOpeningHolds','seedOpeningJobs'])s[key]??=new Map();}
export class SeedOpenings {
 constructor({packs,reader,clock=()=>Date.now()}){
  if(!packs||typeof reader?.read!=='function'||typeof reader?.validatePool!=='function'||!reader.binding)fail('canonical opening dependencies required');
  Object.assign(this,{packs,store:packs.store,identity:packs.identity,reader,clock});packs.openingsEnabled=true;packs.openingVerifier=reader;
 }
 async status(token,packId){
  if(!id(packId))fail('invalid opening pack');const principal=await this.identity.registeredPrincipal(token);
  return this.store.transact(s=>{this.packs.guard(s,token,principal);seedOpeningState(s);const p=s.seedPacks.get(packId);if(!p||p.owner!==principal)fail('opening ownership required');return structuredClone(s.seedOpenings.get(packId)??{packId,status:'not-committed'});});
 }
 async open(token,packId){
  if(!id(packId))fail('invalid opening pack');const principal=await this.identity.registeredPrincipal(token);
  const snapshot=await this.store.transact(s=>{this.packs.guard(s,token,principal);seedOpeningState(s);const p=s.seedPacks.get(packId);if(!p||p.owner!==principal||p.starterCultivarId)fail('standard pack ownership required');return {pack:structuredClone(p),existing:structuredClone(s.seedOpenings.get(packId))};});
  if(snapshot.existing)return snapshot.existing;
  const pack=snapshot.pack;if(pack.status!=='sealed'||pack.policyVersion!==SEED_PACK_POLICY.version||pack.seeds!==3||!['authorized-allocation','settled-purchase'].includes(pack.source?.kind))fail('eligible sealed pack source required');
  const wallet=address(await this.identity.walletOf(token)),pool=poolDefinition(this.packs.catalogue,pack.region);
  await this.packs.verifyPurchase(pack,wallet);
  await this.reader.validatePool(pool);
  // Admission never shrinks a tier to whichever genomes or supply happen to be available.
  const eligible=[];
  for(const cid of pool.tiers.flat()){
   const g=await this.packs.reader.cultivar(cid);
   if(g?.cultivarId!==cid||!['registered-common-reference','finalized-canonical-breeding','registered-founding-line'].includes(g.basis))fail('complete registered opening pool required');eligible.push(g);
  }
  return this.store.transact(s=>{
   this.packs.guard(s,token,principal);seedOpeningState(s);
   const existing=s.seedOpenings.get(packId);if(existing)return structuredClone(existing);
   const current=s.seedPacks.get(packId),binding=s.runtimeWallets?.get(principal);
   if(JSON.stringify(current)!==JSON.stringify(pack)||binding?.wallet!==wallet)fail('opening authority or pack changed');
   const source=s.seedPackSources.get((pack.source.kind==='settled-purchase'?'purchase:':'allocation:')+pack.source.receiptId);
   if(!source||source.issuer!==pack.source.issuer||!source.packIds.includes(packId)||source.request.owner!==principal||source.request.region!==pack.region)fail('opening source admission missing');
   const prepaid=pack.source.kind==='settled-purchase'?s.seedPurchases?.get(pack.source.receiptId):null;
   if(pack.source.kind==='settled-purchase'&&!prepaid)fail('purchase seed reservation absent');
   if(prepaid&&(prepaid.status!=='paid'||prepaid.holdStatus!=='reserved'||prepaid.poolHash!==pool.hash||eligibleGenomeCommitment(prepaid.eligible)!==eligibleGenomeCommitment(eligible)))fail('purchase seed reservation mismatch');
   for(const cid of pool.tiers.flat()){
    if(prepaid){if(used(s.seedOpeningHolds,cid)<3)fail('purchase seed reservation absent');continue;}
    const cap=this.packs.catalogue.detail(cid).tier==='exclusive'?SEED_PACK_POLICY.maxExclusiveSeedUnitsPerCultivar:SEED_PACK_POLICY.maxSeedUnitsPerCultivar;
    if(used(s.seedSupply,'seeds:'+cid)+used(s.seedOpeningHolds,cid)+3>cap)fail('complete opening pool supply unavailable');
   }
   if(prepaid)prepaid.holdStatus='opening';else for(const cid of pool.tiers.flat())s.seedOpeningHolds.set(cid,used(s.seedOpeningHolds,cid)+3);
   const intent={packId,owner:principal,ownerEpoch:s.runtimeEpochs?.get(principal)??0,ownerProfile:binding.profile,wallet,gameId:this.identity.gameId,deployment:structuredClone(this.reader.binding),pool:pool.index,poolHash:pool.hash,policyHash:OPENING_POLICY_HASH,openingKey:openingKey(this.identity.gameId,packId),commitment:null,sourcePack:pack,eligible,status:'committed',createdAt:this.clock(),requestId:null,outcome:null};
   intent.commitment=openingCommitment(intent);intent.purpose=openingPurpose(intent);intent.calldata=calldata('requestOpening(bytes32,address,uint8,bytes32)',intent.openingKey,wallet,intent.pool,intent.commitment);
   s.seedOpenings.set(packId,intent);current.status='opening-committed';return structuredClone(intent);
  });
 }
 async apply(intent,evidence,authorize){
  return this.store.transact(s=>{
   authorize(s);seedOpeningState(s);const current=s.seedOpenings.get(intent.packId);
   if(!current||current.commitment!==intent.commitment)fail('opening reservation changed');
   if(current.status==='fulfilled')return structuredClone(current);
   if(!evidence)return structuredClone(current);
   if(evidence.openingKey!==intent.openingKey||evidence.commitment!==intent.commitment||!evidence.requestId)fail('opening evidence binding mismatch');
   if(current.requestId&&current.requestId!==evidence.requestId)fail('opening request identity changed');
   current.requestId=evidence.requestId;current.chainEvidence=structuredClone(evidence);
   if(!evidence.fulfilled){current.status='awaiting-randomness';return structuredClone(current);}
   const pool=poolDefinition(this.packs.catalogue,s.seedPacks.get(intent.packId).region),selected=selectSeedOutcome(pool,evidence.entropy,evidence.requestId);
   if(pool.hash!==current.poolHash||selected.tierIndex!==evidence.tier||selected.index!==evidence.index)fail('opening selection mismatch');
   const genome=current.eligible.find(g=>g.cultivarId===selected.cultivarId);if(!genome)fail('opening genome reservation absent');
   for(const cid of pool.tiers.flat()){const held=used(s.seedOpeningHolds,cid);if(held<3)fail('opening supply reservation missing');s.seedOpeningHolds.set(cid,held-3);}
   const key='seeds:'+selected.cultivarId,cap=selected.tier==='exclusive'?SEED_PACK_POLICY.maxExclusiveSeedUnitsPerCultivar:SEED_PACK_POLICY.maxSeedUnitsPerCultivar;if(used(s.seedSupply,key)+3>cap)fail('selected seed supply promise violated');s.seedSupply.set(key,used(s.seedSupply,key)+3);
   current.status='fulfilled';current.outcome={...selected,genomeId:genome.genomeId,breedingEventId:genome.breedingEventId??'0',requestId:evidence.requestId,entropy:evidence.entropy,proofHash:evidence.proofHash,anchor:evidence.anchor};current.fulfilledAt=this.clock();
   const p=s.seedPacks.get(intent.packId);p.status='outcome-ready';p.outcome={cultivarId:selected.cultivarId,cultivarName:this.packs.catalogue.detail(selected.cultivarId).name,tier:selected.tier,verification:{contract:evidence.contract,openingKey:intent.openingKey,requestId:evidence.requestId,entropy:evidence.entropy,proofHash:evidence.proofHash,anchor:evidence.anchor}};
   return structuredClone(current);
  });
 }
 async reconcile(token,packId){
  const intent=await this.status(token,packId);if(intent.status==='not-committed')fail('committed opening required');if(intent.status==='fulfilled')return intent;
  const principal=await this.identity.registeredPrincipal(token),evidence=await this.reader.read(intent);
  return this.apply(intent,evidence,s=>this.packs.guard(s,token,principal));
 }
 async pending(token,{after='',limit=100}){
  if((after!==''&&!id(after))||!Number.isSafeInteger(limit)||limit<1||limit>100)fail('invalid opening queue page');
  await this.identity.requireTrustedIssuer(token,'seed-packs');const issuer=await this.identity.registeredPrincipal(token);
  return this.store.transact(s=>{this.packs.guard(s,token,issuer,true);seedOpeningState(s);const rows=[...s.seedOpenings.values()].filter(i=>i.status!=='fulfilled'&&i.packId>after).sort((a,b)=>a.packId<b.packId?-1:a.packId>b.packId?1:0);return {intents:rows.slice(0,limit).map(i=>structuredClone(i)),next:rows.length>limit?rows[limit-1].packId:null};});
 }
}
