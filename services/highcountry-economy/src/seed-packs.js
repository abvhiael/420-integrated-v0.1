// HC-SEED-07: durable issuance. Draws and payment settlement belong to HC-SEED-08/09.
import {SettlementError} from './buds-ledger.js';
import {keccak256} from './keccak.js';
import {calldata,address} from './finalized-rpc.js';
const fail=m=>{throw new SettlementError(m);};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>keccak256(Buffer.from(JSON.stringify(x)));
export const SEED_PACK_POLICY=Object.freeze({version:'HC.SEED.PACKS.V1',seedsPerPack:3,starterPacks:2,starterAccountLimit:100000,standardLimitPerPool:100000,maxSeedUnitsPerCultivar:100000,maxExclusiveSeedUnitsPerCultivar:10000,priceBuds:420,priceNative420Wei:'1000000000000000000',oddsBps:Object.freeze({common:6000,rare:3000,exclusive:1000})});
export const SEED_REGIONS=Object.freeze(['Emerald Coast','Golden Prairie','Red Mesa']);
const used=(s,key)=>{const n=s.seedSupply.get(key)??0;if(!Number.isSafeInteger(n)||n<0)fail('corrupt seed supply');return n;};
const keys=['seedPacks','seedPackSources','seedStarterGrants','seedSupply','seedLotIntents','seedLotIds','seedStarterWalletClaims'];
export function seedPackState(s){for(const k of keys)s[k]??=new Map();return s;}
export class SeedPacks {
 constructor({store,identity,catalogue,reader,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||identity?.store!==store||typeof identity?.registeredPrincipal!=='function'||typeof identity?.verifyToken!=='function'||typeof identity?.requireTrustedIssuer!=='function'||typeof identity?.walletOf!=='function'||!catalogue?.rows||typeof reader?.cultivar!=='function'||typeof reader?.issuedLot!=='function')fail('seed issuance authority required');
  Object.assign(this,{store,identity,catalogue,reader,clock});
  this.pools=new Map();
  for(const region of [...SEED_REGIONS,'World']){
   const tiers=Object.fromEntries(['common','rare','exclusive'].map(tier=>[tier,[...catalogue.rows.values()].filter(c=>c.tier===tier&&(region==='World'||c.region===region)).map(c=>c.id).sort()]));
   if(Object.values(tiers).some(p=>!p.length))fail('empty seed pool');this.pools.set(region,tiers);
  }
 }
 guard(s,token,principal,operator=false){
  const c=this.identity.verifyToken(token);
  if(c.sub!==principal||s.runtimeAccounts?.get(principal)?.issuer!==c.iss||(s.runtimeEpochs?.get(principal)??0)!==c.epoch)fail('seed issuance session revoked');
  if(operator&&!this.identity.issuers[c.iss]?.operators?.[principal]?.sources?.includes('seed-packs'))fail('seed pack issuer denied');
 }
 policy(){return {policy:structuredClone(SEED_PACK_POLICY),pools:structuredClone(Object.fromEntries(this.pools)),purchaseStatus:'awaiting-HC-SEED-09',openingStatus:'standard-packs-await-HC-SEED-08'};}
 async inventory(token){const principal=await this.identity.registeredPrincipal(token);return this.store.transact(s=>{this.guard(s,token,principal);seedPackState(s);return {policyVersion:SEED_PACK_POLICY.version,starterClaimed:s.seedStarterGrants.has(principal),packs:[...s.seedPacks.values()].filter(p=>p.owner===principal).map(p=>structuredClone(p)),lots:[...s.seedLotIntents.values()].filter(p=>p.owner===principal).map(p=>structuredClone(p))};});}
 create(s,{packId,owner,region,source,starterCultivarId=null}){
  if(s.seedPacks.has(packId))fail('duplicate seed pack');
  const pack={id:packId,owner,region,policyVersion:SEED_PACK_POLICY.version,seeds:3,status:'sealed',source:structuredClone(source),starterCultivarId,createdAt:this.clock()};s.seedPacks.set(packId,pack);return structuredClone(pack);
 }
 async starter(token,region){
  if(!SEED_REGIONS.includes(region))fail('starter region invalid');
  const principal=await this.identity.registeredPrincipal(token);
  return this.store.transact(s=>{
   this.guard(s,token,principal);seedPackState(s);
   const existing=s.seedStarterGrants.get(principal);
   if(existing){if(existing.region!==region)fail('starter already issued in another region');return existing.packIds.map(id=>structuredClone(s.seedPacks.get(id)));}
   const count=used(s,'starter:accounts');if(count>=SEED_PACK_POLICY.starterAccountLimit)fail('starter supply exhausted');
   // Fixed catalogue allocations, not a chance draw. Exactly two distinct common cultivars.
   const cultivars=this.pools.get(region).common.slice(0,2);
   for(const cid of cultivars){const key='seeds:'+cid,previous=used(s,key);if(previous+3>SEED_PACK_POLICY.maxSeedUnitsPerCultivar)fail('starter cultivar supply exhausted');s.seedSupply.set(key,previous+3);}
   const packIds=cultivars.map((cid,i)=>'starter:'+hash([this.identity.gameId,principal,i]).slice(2));
   const source={kind:'starter',principal,policyVersion:SEED_PACK_POLICY.version,region};
   const packs=packIds.map((packId,i)=>this.create(s,{packId,owner:principal,region,source,starterCultivarId:cultivars[i]}));
   s.seedSupply.set('starter:accounts',count+1);s.seedStarterGrants.set(principal,{region,packIds,source});return packs;
  });
 }
 // Explicit, capped operator allocations. This endpoint cannot assert a paid purchase.
 async allocate(token,{receiptId,owner,region,count}){
  if(!valid(receiptId)||!valid(owner)||!this.pools.has(region)||!Number.isSafeInteger(count)||count<1||count>100)fail('invalid seed allocation');
  await this.identity.requireTrustedIssuer(token,'seed-packs');const issuer=await this.identity.registeredPrincipal(token);
  return this.store.transact(s=>{
   this.guard(s,token,issuer,true);seedPackState(s);if(!s.runtimeAccounts?.has(owner))fail('registered recipient required');
   const key='allocation:'+receiptId,request={owner,region,count};const old=s.seedPackSources.get(key);
   if(old){if(JSON.stringify(old.request)!==JSON.stringify(request)||old.issuer!==issuer)fail('seed source replay mismatch');return old.packIds.map(id=>structuredClone(s.seedPacks.get(id)));}
   const supplyKey='standard:'+region,previous=used(s,supplyKey);
   if(previous+count>SEED_PACK_POLICY.standardLimitPerPool)fail('pack supply exhausted');
   const source={kind:'authorized-allocation',receiptId,issuer,policyVersion:SEED_PACK_POLICY.version};
   const packs=Array.from({length:count},(_,i)=>this.create(s,{packId:'pack:'+hash([this.identity.gameId,key,i]).slice(2),owner,region,source}));
   s.seedSupply.set(supplyKey,previous+count);s.seedPackSources.set(key,{issuer,request,packIds:packs.map(p=>p.id),source});return packs;
  });
 }
 async prepare(token,packId){
  if(!valid(packId))fail('invalid seed pack');const principal=await this.identity.registeredPrincipal(token);
  const pack=await this.store.transact(s=>{this.guard(s,token,principal);seedPackState(s);const p=s.seedPacks.get(packId);if(!p||p.owner!==principal)fail('pack ownership required');return structuredClone(p);});
  if(!pack.starterCultivarId)fail('canonical HC-SEED-08 pack outcome required');
  const wallet=address(await this.identity.walletOf(token));
  const genome=await this.reader.cultivar(pack.starterCultivarId);
  if(!genome||genome.cultivarId!==pack.starterCultivarId||genome.basis!=='registered-common-reference')fail('registered common genome required');
  return this.store.transact(s=>{
   this.guard(s,token,principal);seedPackState(s);if(s.runtimeWallets?.get(principal)?.wallet!==wallet)fail('seed wallet binding changed');
   const current=s.seedPacks.get(packId);if(JSON.stringify(current)!==JSON.stringify(pack))fail('pack changed during preparation');
   const walletClaim=s.seedStarterWalletClaims.get(wallet);if(walletClaim&&walletClaim!==principal)fail('starter wallet already used by another account');
   const existing=s.seedLotIntents.get(packId);if(existing){if(existing.wallet!==wallet)fail('issued seed wallet is immutable');return structuredClone(existing);}
   const cid=pack.starterCultivarId;
   const metadataHash=hash(['HC.SEED.LOT.V1',this.identity.gameId,SEED_PACK_POLICY.version,packId,principal,wallet,cid,genome.genomeId,pack.seeds]);
   const lotId=BigInt(hash(['HC.SEED.LOT.ID.V1',this.identity.gameId,packId]).slice(0,18)).toString();
   if(lotId==='0'||s.seedLotIds.has(lotId))fail('seed lot identity collision');
   const intent={packId,owner:principal,ownerEpoch:s.runtimeEpochs?.get(principal)??0,wallet,cultivarId:cid,genomeId:genome.genomeId,breedingEventId:'0',quantity:pack.seeds,lotId,metadataHash,status:'prepared',policyVersion:SEED_PACK_POLICY.version,genomeEvidence:genome,source:pack.source};
   intent.calldata=calldata('registerSeedLot(uint64,bytes32,uint64,address,uint32,bytes32)',lotId,intent.genomeId,0,wallet,intent.quantity,metadataHash);
   s.seedStarterWalletClaims.set(wallet,principal);s.seedLotIds.set(lotId,packId);s.seedLotIntents.set(packId,intent);current.status='issuance-prepared';return structuredClone(intent);
  });
 }
 async confirm(token,packId){
  if(!valid(packId))fail('invalid seed pack');const principal=await this.identity.registeredPrincipal(token);
  const intent=await this.store.transact(s=>{this.guard(s,token,principal);seedPackState(s);const i=s.seedLotIntents.get(packId);if(!i||i.owner!==principal)fail('seed issuance ownership required');return structuredClone(i);});
  if(intent.status==='issued')return intent;
  const evidence=await this.reader.issuedLot(intent);
  return this.store.transact(s=>{
   this.guard(s,token,principal);seedPackState(s);const current=s.seedLotIntents.get(packId);
   if(!current||current.metadataHash!==intent.metadataHash)fail('seed issuance changed');
   if(current.status==='issued')return structuredClone(current);
   current.status='issued';current.evidence=evidence;current.issuedAt=this.clock();s.seedPacks.get(packId).status='opened';return structuredClone(current);
  });
 }
}
