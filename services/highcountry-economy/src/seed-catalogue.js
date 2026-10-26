import {reconcileSeedArt} from './seed-art.js';
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export class SeedCatalogue {
 constructor({catalog,research,rarePairs,founders}){
  if(catalog?.cultivars?.length!==65||research?.cultivars?.length!==23||rarePairs?.pairs?.length!==26||founders?.founders?.length!==16)throw new SettlementError('seed catalogue cardinality');
  const artwork=reconcileSeedArt(catalog);
  this.rows=new Map();const studied=new Map(research.cultivars.map(e=>[e.cultivarId,e]));
  const pairs=new Map(rarePairs.pairs.map(e=>[e.cultivarId,e]));
  const names=new Map(catalog.cultivars.map(e=>[e.id,e.name]));
  for(const c of catalog.cultivars){
   if(!id(c.id)||this.rows.has(c.id)||!['common','rare','exclusive'].includes(c.tier)||!['Emerald Coast','Golden Prairie','Red Mesa'].includes(c.region))throw new SettlementError('seed identity');
   const row={id:c.id,name:c.name,tier:c.tier,region:c.region,artStatus:'approved-cosmetic',art:artwork.get(c.id),geneticSemantics:'Reference descriptions do not change a plant’s yield, potency or growing requirements.'};
   if(c.tier==='common'){
    const r=studied.get(c.id);if(r?.canonicalName!==c.name||r.canonicalRegion!==c.region)throw new SettlementError('research identity');
    row.ancestry={basis:'attributed-research',status:r.ancestry.status,candidates:r.ancestry.candidateParentSets,uncertainty:r.uncertainty.notes};
    row.characteristics={classification:r.characteristics.publisherClassification,flavors:r.characteristics.reportedFlavors,terpenes:r.characteristics.profileTerpenes,morphology:r.characteristics.morphologySummary};
    row.history=r.history.summary;row.sources=r.sources.map(s=>({title:s.sourceTitle,url:s.url}));
   }else if(c.tier==='rare'){
    const p=pairs.get(c.id);if(p?.canonicalName!==c.name||p.canonicalRegion!==c.region||!names.has(p.parentA)||!names.has(p.parentB)||p.parentA===p.parentB)throw new SettlementError('rare ancestry identity');
    row.ancestry={basis:'approved-game-cross',status:'planned-cross; registration requires canonical evidence',parents:[p.parentA,p.parentB].map(v=>({id:v,name:names.get(v)}))};
    row.history='A fictional HighCountry cross. Actual offspring must come from canonical breeding; no unverified phenotype is assigned.';row.characteristics=null;row.sources=[];
   }else{
    const f=founders.founders.find(f=>f.id===c.id);if(f?.name!==c.name||f.region!==c.region)throw new SettlementError('founder identity');
    row.ancestry={basis:'original-sixteen-heritage',status:'ancestry not encoded as verified biological pedigree'};
    row.history=`${f.heritageClassification} · ${f.origin} · ${f.archiveDesignation}`;row.characteristics=null;row.sources=[];
   }
   this.rows.set(c.id,structuredClone(row));
  }
 }
 browse(filters={}){
  if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.keys(filters).some(k=>!['search','region','tier'].includes(k)))throw new SettlementError('catalogue filters denied');
  const {search='',region='',tier=''}=filters;
  if(typeof search!=='string'||search.length>80||!['','Emerald Coast','Golden Prairie','Red Mesa'].includes(region)||!['','common','rare','exclusive'].includes(tier))throw new SettlementError('catalogue filters invalid');
  const q=search.normalize('NFKC').trim().toLowerCase();
  return {schema:'HC.SEED.CATALOGUE.V1',total:65,entries:[...this.rows.values()].filter(e=>(!q||(e.name+' '+e.id).toLowerCase().includes(q))&&(!region||e.region===region)&&(!tier||e.tier===tier)).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>structuredClone(e))};
 }
 detail(cultivarId){const e=this.rows.get(cultivarId);if(!e)throw new SettlementError('unknown cultivar');return structuredClone(e);}
}
export class SeedCollection {
 constructor({store,identity,catalogue,reader,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||identity?.store!==store||typeof identity?.registeredPrincipal!=='function'||typeof identity?.verifyToken!=='function'||typeof identity?.walletOf!=='function'||!(catalogue instanceof SeedCatalogue)||typeof reader?.ownership!=='function'||typeof reader?.harvest!=='function')throw new SettlementError('authoritative seed dependencies required');
  Object.assign(this,{store,identity,catalogue,reader,clock});
 }
 state(s){s.seedDiscoveries??=new Map();s.seedHarvestCards??=new Map();s.seedHarvestClaims??=new Map();}
 guard(s,token,principal,wallet=null){
  const claim=this.identity.verifyToken(token);
  if(claim.sub!==principal||s.runtimeAccounts?.get(principal)?.issuer!==claim.iss||(s.runtimeEpochs?.get(principal)??0)!==claim.epoch)throw new SettlementError('seed session revoked');
  if(wallet&&s.runtimeWallets?.get(principal)?.wallet!==wallet)throw new SettlementError('seed wallet binding revoked');
 }
 async context(token){
  const principal=await this.identity.registeredPrincipal(token);
  const binding=await this.store.transact(s=>{this.guard(s,token,principal);return s.runtimeWallets?.get(principal);});
  const wallet=binding?await this.identity.walletOf(token):null;
  return {principal,wallet};
 }
 async snapshot(token){
  const {principal,wallet}=await this.context(token);
  // Unlinked accounts may browse; missing canonical ownership is not reported as a verified zero balance.
  const owned=wallet?await this.reader.ownership(wallet):null;
  return this.store.transact(s=>{
   this.guard(s,token,principal,wallet);this.state(s);
   const discovered=new Set(s.seedDiscoveries.get(principal)??[]);
   for(const cid of owned?.discovered??[])if(this.catalogue.rows.has(cid))discovered.add(cid);
   s.seedDiscoveries.set(principal,[...discovered]);
   const cards=[...s.seedHarvestCards.values()].filter(e=>e.principal===principal).map(e=>structuredClone(e));
   const entries=[...this.catalogue.rows.values()].map(e=>({id:e.id,discovered:discovered.has(e.id),ownedSeeds:wallet?(owned.quantities[e.id]??0):null,harvested:cards.some(c=>c.cultivarId===e.id),provenance:owned?.provenance?.[e.id]??cards.find(c=>c.cultivarId===e.id)?.firstHarvest?.provenance??null}));
   return {schema:'HC.SEED.COLLECTION.V1',ownershipStatus:wallet?'verified-finalized':'wallet-not-linked',anchor:owned?.anchor??null,entries,cards,uncataloguedLots:owned?.uncataloguedLots??0};
  });
 }
 async claimHarvest(token,plantId){
  if(typeof plantId!=='string'||!/^\d{1,20}$/.test(plantId)||BigInt(plantId)<1n||BigInt(plantId)>2n**64n-1n)throw new SettlementError('invalid harvest plant');
  const {principal,wallet}=await this.context(token);if(!wallet)throw new SettlementError('canonical wallet binding required for harvest evidence');
  const h=await this.reader.harvest(wallet,BigInt(plantId).toString());
  if(!h||!this.catalogue.rows.has(h.cultivarId)||!h.sourceKey||h.successful!==true)throw new SettlementError('successful canonical harvest required');
  return this.store.transact(s=>{
   this.guard(s,token,principal,wallet);this.state(s);
   const previous=s.seedHarvestClaims.get(h.sourceKey);
   if(previous){if(previous.principal!==principal)throw new SettlementError('harvest already claimed by another account');return structuredClone(s.seedHarvestCards.get(previous.cardKey));}
   const cardKey=JSON.stringify([principal,h.cultivarId]);
   const card=s.seedHarvestCards.get(cardKey)??{id:'HC-HARVEST-CARD:'+h.cultivarId,principal,cultivarId:h.cultivarId,nonTransferable:true,cosmeticOnly:true,awardedAt:this.clock(),firstHarvest:structuredClone(h)};
   s.seedHarvestCards.set(cardKey,card);s.seedHarvestClaims.set(h.sourceKey,{principal,cardKey});
   const found=new Set(s.seedDiscoveries.get(principal)??[]);found.add(h.cultivarId);s.seedDiscoveries.set(principal,[...found]);
   return structuredClone(card);
  });
 }
}
