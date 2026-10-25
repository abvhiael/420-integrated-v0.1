// HC-NEXT-5.3: authoritative original-sixteen journey bridge. Only issuer-authenticated activity.
import {SettlementError} from './buds-ledger.js';
import {validateArchive} from '../../highcountry-archive/src/archive-discovery.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export class DiscoveryIntegration {
 constructor({store,identity,journeys,canonical,verifyEvidence,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof verifyEvidence!=='function'||typeof clock!=='function')
   throw new SettlementError('trusted discovery dependencies required');
  validateArchive(journeys,canonical);
  Object.assign(this,{store,identity,journeys,verifyEvidence,clock});
  this.objectives=new Map();
  for(const founder of journeys.journeys)for(const fragment of founder.fragments){
   for(const objective of [fragment.trigger,fragment.alternate]){
    if(!id(objective.objectiveId)||!['archive.landmark_inspected','archive.record_researched',
      'archive.preservation_milestone','archive.evidence_reconstructed','archive.accessible_research'].includes(objective.type)
      ||!objective.site||!objective.verifiedBy)throw new SettlementError('unapproved discovery objective');
    this.objectives.set(objective.objectiveId,{founder,fragment,objective});
   }
  }
 }
 _state(s){s.discoveryFragments??=new Map();s.discoveryEvents??=new Set();s.discoveryEntitlements??=new Map();}
 _session(s,token,principal){
  if(typeof this.identity.verifyToken!=='function')return;
  const claim=this.identity.verifyToken(token);
  if(claim?.sub!==principal||!Number.isSafeInteger(claim.epoch)
   ||(s.runtimeEpochs?.get(principal)??0)!==claim.epoch)
   throw new SettlementError('discovery session revoked');
 }
 async _principal(token){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal))throw new SettlementError('registered discovery account required');
  return principal;
 }
 async snapshot(token){
  const principal=await this._principal(token);
  return this.store.transact(s=>{
   this._state(s);this._session(s,token,principal);
   const fragments=s.discoveryFragments.get(principal)??[];
   const entitlements=s.discoveryEntitlements.get(principal)??[];
   return {schema:this.journeys.schema,founders:this.journeys.journeys.map(f=>({
    founderId:f.founderId,founderName:f.founderName,region:f.region,
    fragments:f.fragments.map(g=>({fragmentId:g.fragmentId,title:g.title,
     earned:fragments.includes(g.fragmentId),
     primary:{type:g.trigger.type,site:g.trigger.site,objectiveId:g.trigger.objectiveId},
     accessible:{type:g.alternate.type,site:g.alternate.site,objectiveId:g.alternate.objectiveId}})),
    revelation:f.final.title,revealed:entitlements.includes(f.final.id)})),
    master:entitlements.includes('ORIGINAL_SIXTEEN_MASTER'),entitlements};
  });
 }
 async ingest(token,operation,objectiveId,evidence){
  const principal=await this._principal(token),target=this.objectives.get(objectiveId);
  if(!id(operation)||!target||typeof evidence!=='string'||!evidence||evidence.length>8192)
   throw new SettlementError('invalid discovery request');
  const approved=await this.verifyEvidence({principal,missionId:objectiveId,
   version:this.journeys.schema,objective:target.objective.type,evidence,amount:1});
  if(!approved||!id(approved.sourceEvent))
   throw new SettlementError('independent activity evidence required');
  return this.store.transact(s=>{
   this._state(s);this._session(s,token,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed discovery operation');
   if(s.discoveryEvents.has(approved.sourceEvent)||s.missionProofs?.has(approved.sourceEvent)
    ||s.skillResearchProofs?.has(approved.sourceEvent))
    throw new SettlementError('replayed activity evidence');
   const owned=s.discoveryFragments.get(principal)??[];
   if(owned.includes(target.fragment.fragmentId))
    throw new SettlementError('discovery already completed');
   owned.push(target.fragment.fragmentId);s.discoveryFragments.set(principal,owned);
   s.discoveryEvents.add(approved.sourceEvent);s.operations.add(operation);
   const ent=s.discoveryEntitlements.get(principal)??[];
   const f=target.founder;
   let revelation=false,master=false;
   if(f.fragments.every(z=>owned.includes(z.fragmentId))&&!ent.includes(f.final.id)){
    ent.push(f.final.id);revelation=true;
    if(this.journeys.journeys.every(z=>ent.includes(z.final.id))
      &&!ent.includes('ORIGINAL_SIXTEEN_MASTER')){
     ent.push('ORIGINAL_SIXTEEN_MASTER');master=true;
    }
   }
   s.discoveryEntitlements.set(principal,ent);
   return {status:'unlocked',fragmentId:target.fragment.fragmentId,
    founderId:f.founderId,revelation,master};
  });
 }
}
