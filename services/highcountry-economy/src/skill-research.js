// HC-NEXT-5.1: version-pinned, authenticated, noncanonical gameplay progression.
// This module has no contract writer, ERC20 bridge, inventory mint or protected stat mutation.
import {SettlementError,BudsLedger} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const integer=(x,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
const cap=10000;
const reserved=new Set(['yield','harvest','potency','quality','genetics','competitive','score','capacity','asset','canonical','reward','buds','wallet','mint','rarity','drop-rate']);
const effects=new Set(['journal-slots','research-queue','cosmetic-palette','archive-filters','workshop-layout','recipe-notes']);
export function validateProgressionCatalog(c){
 if(!c||!id(c.version)||!Array.isArray(c.tracks)||!c.tracks.length||c.tracks.length>128)
  throw new SettlementError('invalid progression catalogue');
 const seen=new Set(),ordered=[];
 for(const t of c.tracks){
  if(!t||!id(t.id)||seen.has(t.id)||!['skill','research'].includes(t.kind)||!id(t.effect)
   ||!effects.has(t.effect)||reserved.has(t.effect)||!integer(t.cost,1000000)||!integer(t.requiredPoints,1000000)
   ||t.cost<1||t.requiredPoints<1||!integer(t.maxPointsPerProof,1000)||t.maxPointsPerProof<1
   ||t.maxPointsPerProof>t.requiredPoints||!integer(t.effectValue,cap)||t.effectValue<1
   ||!integer(t.cap,cap)||t.cap<t.effectValue||!integer(t.minLevel,100)||t.minLevel<1
   ||!Array.isArray(t.prerequisites)||t.prerequisites.length>8||t.prerequisites.some(p=>!id(p)||!seen.has(p))
   ||!['none','verified-gameplay'].includes(t.eligibility))
   throw new SettlementError('invalid or unapproved progression track');
  seen.add(t.id);ordered.push(Object.freeze({...t,prerequisites:Object.freeze([...t.prerequisites])}));
 }
 return Object.freeze({version:c.version,tracks:Object.freeze(ordered)});
}
export class SkillResearchService {
 constructor({store,identity,catalog,verifyEvidence,getPlayerLevel,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof verifyEvidence!=='function'||typeof getPlayerLevel!=='function'||typeof clock!=='function')
   throw new SettlementError('progression authority not configured');
  this.catalog=validateProgressionCatalog(catalog);Object.assign(this,{store,identity,verifyEvidence,getPlayerLevel,clock});
  this.ledger=new BudsLedger(store,null);
 }
 _state(s){if(!s.skillResearch)s.skillResearch=new Map();if(!s.skillResearchProofs)s.skillResearchProofs=new Set();}
 _session(s,session,principal){
  if(typeof this.identity.verifyToken!=='function')return;
  const claims=this.identity.verifyToken(session);
  if(claims?.sub!==principal||!Number.isSafeInteger(claims.epoch)
    ||(s.runtimeEpochs?.get(principal)??0)!==claims.epoch)
   throw new SettlementError('progression account authority revoked');
 }
 async snapshot(session){
  const principal=await this.identity.registeredPrincipal(session);if(!id(principal))throw new SettlementError('unregistered player');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   const records=this.catalog.tracks.map(t=>{
    const r=s.skillResearch.get(JSON.stringify([principal,t.id,this.catalog.version]))||
     {points:0,unlocked:false};
    return {id:t.id,kind:t.kind,version:this.catalog.version,points:r.points,unlocked:r.unlocked,
     requiredPoints:t.requiredPoints,cost:t.cost,prerequisites:t.prerequisites,
     eligibility:t.eligibility,effect:t.effect,effectValue:t.effectValue,cap:t.cap,minLevel:t.minLevel};
   });
   const effects={};
   for(const track of this.catalog.tracks){
    const key=JSON.stringify([principal,track.id,this.catalog.version]);
    if(s.skillResearch.get(key)?.unlocked!==true)continue;
    effects[track.effect]=Math.min(track.cap,(effects[track.effect]??0)+track.effectValue);
   }
   const history=[...s.skillResearch].flatMap(([key,record])=>{
    let tuple;try{tuple=JSON.parse(key);}catch{return [];}
    if(!Array.isArray(tuple)||tuple.length!==3||tuple[0]!==principal||tuple[2]===this.catalog.version)return [];
    return [{trackId:tuple[1],version:tuple[2],points:record.points,unlocked:record.unlocked===true}];
   }).slice(-100);
   return {version:this.catalog.version,records,history,effects,availableBuds:s.balances.get(principal)?.available??0};
  });
 }
 // Evidence is checked independently by the configured verifier. The caller cannot attest its own points.
 async progress(session,operation,trackId,evidence,points){
  const principal=await this.identity.registeredPrincipal(session);
  if(!id(principal)||!id(operation)||!id(trackId)||typeof evidence!=='string'||!evidence||evidence.length>8192||!integer(points,1000)||!points)
   throw new SettlementError('invalid progression request');
  const track=this.catalog.tracks.find(t=>t.id===trackId);
  if(!track||points>track.maxPointsPerProof)throw new SettlementError('track proof cap exceeded');
  const verified=await this.verifyEvidence({principal,trackId,version:this.catalog.version,evidence,points});
  if(!verified||!id(verified.sourceEvent))throw new SettlementError('independent progression evidence required');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const proofKey=verified.sourceEvent;
   if(s.skillResearchProofs.has(proofKey))throw new SettlementError('replayed progression evidence');
   const key=JSON.stringify([principal,trackId,this.catalog.version]);
   const r=s.skillResearch.get(key)||{points:0,unlocked:false};
   if(r.unlocked||r.points+points>track.requiredPoints)throw new SettlementError('progression capped');
   r.points+=points;s.skillResearch.set(key,r);s.skillResearchProofs.add(proofKey);s.operations.add(operation);
   return {trackId,version:this.catalog.version,points:r.points,unlocked:false};
  });
 }
 async unlock(session,operation,trackId){
  const principal=await this.identity.registeredPrincipal(session);
  if(!id(principal)||!id(operation)||!id(trackId))
   throw new SettlementError('invalid skill unlock request');
  const track=this.catalog.tracks.find(t=>t.id===trackId);
  if(!track)throw new SettlementError('unknown progression track');
  const playerLevel=await this.getPlayerLevel({principal,session});
  if(!integer(playerLevel,100))throw new SettlementError('invalid verified player level');
  return this.ledger.operate(operation,s=>{
   this._state(s);this._session(s,session,principal);
   const key=JSON.stringify([principal,trackId,this.catalog.version]);
   const r=s.skillResearch.get(key);
   if(!r||r.unlocked||r.points!==track.requiredPoints||playerLevel<track.minLevel)
    throw new SettlementError('progression not eligible');
   for(const prerequisite of track.prerequisites){
    if(s.skillResearch.get(JSON.stringify([principal,prerequisite,this.catalog.version]))?.unlocked!==true)
     throw new SettlementError('missing prerequisite');
   }
   const b=this.ledger.get(s,principal);
   if(b.available<track.cost)throw new SettlementError('insufficient BUDS');
   b.available-=track.cost;s.burned+=track.cost;
   if(!integer(s.burned))throw new SettlementError('unsafe BUDS burn');
   r.unlocked=true;r.unlockedAt=this.clock();
   // The effect is a bounded UI convenience entitlement, never a canonical inventory or fairness stat.
   return {trackId,version:this.catalog.version,status:'unlocked',effect:track.effect,
    value:track.effectValue,cap:track.cap,spent:track.cost};
  });
 }
}
