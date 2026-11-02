// HC-NEXT-5.2 registered ordinary missions. Canonical reward settlement is independent.
import {SettlementError} from './buds-ledger.js';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0;
export function validateMissionCatalog(c){
 if(!c||!id(c.version)||!Array.isArray(c.templates)||!c.templates.length||c.templates.length>128)
  throw new SettlementError('invalid mission catalogue');
 const known=new Set();
 const templates=c.templates.map(t=>{
  if(!t||!id(t.id)||known.has(t.id)||!id(t.objective)||!uint(t.target)||t.target<1||t.target>10000
   ||!uint(t.maxPerProof)||t.maxPerProof<1||t.maxPerProof>t.target
   ||!uint(t.durationMs)||t.durationMs<60000||t.durationMs>2592000000
   ||t.rewardUnits!==0||!id(t.badgeId)
   ||(t.prerequisite!==null&&(!id(t.prerequisite)||!known.has(t.prerequisite))))
   throw new SettlementError('invalid mission template');
  known.add(t.id);
  return Object.freeze({...t});
 });
 return Object.freeze({version:c.version,templates:Object.freeze(templates)});
}
export class MissionService{
 constructor({store,identity,catalog,verifyEvidence,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof verifyEvidence!=='function'||typeof clock!=='function')
   throw new SettlementError('untrusted mission dependencies');
  this.catalog=validateMissionCatalog(catalog);Object.assign(this,{store,identity,verifyEvidence,clock});
 }
 _state(s){s.missions??=new Map();s.missionProofs??=new Set();}
 _auth(s,token,principal){
  if(typeof this.identity.verifyToken!=='function')return;
  const c=this.identity.verifyToken(token);
  if(c.sub!==principal||(s.runtimeEpochs?.get(principal)??0)!==c.epoch)
   throw new SettlementError('mission account revoked');
 }
 _key(p,t){return JSON.stringify([p,t,this.catalog.version]);}
 _template(id){const t=this.catalog.templates.find(x=>x.id===id);if(!t)throw new SettlementError('unknown mission');return t;}
 _expire(m,now){if(['active','complete'].includes(m?.status)&&now>=m.deadline){m.status='expired';}}
 async snapshot(token){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal))throw new SettlementError('unregistered player');
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   const now=this.clock();
   const missions=this.catalog.templates.map(t=>{
    const m=s.missions.get(this._key(principal,t.id));if(m)this._expire(m,now);
    return {...t,version:this.catalog.version,status:m?.status??'available',
     progress:m?.progress??0,deadline:m?.deadline??null,
     reward:m?.reward??null};
   });
   const badges=missions.filter(m=>m.status==='claimed'&&m.reward?.kind==='cosmetic-badge')
    .map(m=>({missionId:m.id,badgeId:m.reward.badgeId,version:m.version}));
   return {version:this.catalog.version,missions,badges};
  });
 }
 async activate(token,operation,templateId){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal)||!id(operation))throw new SettlementError('invalid mission activation');
  const t=this._template(templateId);
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   if(s.operations.has(operation)||s.missions.has(this._key(principal,t.id)))
    throw new SettlementError('mission activation replay');
   if(t.prerequisite&&s.missions.get(this._key(principal,t.prerequisite))?.status!=='claimed')
    throw new SettlementError('missing mission prerequisite');
   const startedAt=this.clock(),deadline=startedAt+t.durationMs;
   if(!uint(startedAt)||!uint(deadline))throw new SettlementError('invalid mission clock');
   const m={status:'active',progress:0,startedAt,deadline,objective:t.objective,
    target:t.target,rewardUnits:t.rewardUnits,badgeId:t.badgeId,version:this.catalog.version,proofs:0};
   s.missions.set(this._key(principal,t.id),m);s.operations.add(operation);
   return {id:t.id,status:m.status,deadline};
  });
 }
 async progress(token,operation,templateId,evidence,amount){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal)||!id(operation)||typeof evidence!=='string'||!evidence||evidence.length>8192
   ||!uint(amount)||!amount)throw new SettlementError('invalid mission evidence');
  const t=this._template(templateId);
  if(amount>t.maxPerProof)throw new SettlementError('mission evidence cap');
  const verified=await this.verifyEvidence({principal,missionId:t.id,objective:t.objective,
   version:this.catalog.version,evidence,amount});
  if(!verified||!id(verified.sourceEvent))throw new SettlementError('independent mission proof required');
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   if(s.operations.has(operation)||s.missionProofs.has(verified.sourceEvent)
    ||s.skillResearchProofs?.has(verified.sourceEvent))
    throw new SettlementError('replayed gameplay evidence');
   const m=s.missions.get(this._key(principal,t.id));
   if(!m)throw new SettlementError('mission not activated');
   this._expire(m,this.clock());
   if(m.status!=='active'||m.progress+amount>m.target)throw new SettlementError('mission not active or capped');
   m.progress+=amount;m.proofs++;s.missionProofs.add(verified.sourceEvent);s.operations.add(operation);
   if(m.progress===m.target)m.status='complete';
   return {id:t.id,status:m.status,progress:m.progress,target:m.target};
  });
 }
 async claim(token,operation,templateId){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal)||!id(operation))throw new SettlementError('invalid mission claim');
  const t=this._template(templateId);
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed mission claim');
   const m=s.missions.get(this._key(principal,t.id));
   if(!m)throw new SettlementError('mission not activated');
   this._expire(m,this.clock());
   if(m.status!=='complete')throw new SettlementError('mission not complete or expired');
   // This is an immutable reward *entitlement record*, not BUDS issuance.
   // Existing GameplayRewardRuntime.claim separately authenticates canonical source and mints authorized BUDS.
   m.status='claimed';m.reward={kind:'cosmetic-badge',badgeId:m.badgeId,units:0,
    objective:m.objective,version:m.version};
   s.operations.add(operation);return {id:t.id,status:m.status,reward:m.reward};
  });
 }
 async cancel(token,operation,templateId){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal)||!id(operation))throw new SettlementError('invalid mission cancellation');
  const t=this._template(templateId);
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed cancellation');
   const m=s.missions.get(this._key(principal,t.id));
   if(!m)throw new SettlementError('mission not activated');
   this._expire(m,this.clock());
   if(m.status!=='active')throw new SettlementError('mission cannot be cancelled');
   m.status='cancelled';s.operations.add(operation);return {id:t.id,status:m.status};
  });
 }
 async expire(token,operation,templateId){
  const principal=await this.identity.registeredPrincipal(token);
  if(!id(principal)||!id(operation))throw new SettlementError('invalid mission expiry');
  const t=this._template(templateId);
  return this.store.transact(s=>{
   this._state(s);this._auth(s,token,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed mission expiry');
   const m=s.missions.get(this._key(principal,t.id));
   if(!m)throw new SettlementError('mission not activated');
   if(!['active','complete'].includes(m.status)||this.clock()<m.deadline)
    throw new SettlementError('mission expiry not due');
   m.status='expired';s.operations.add(operation);return {id:t.id,status:m.status};
  });
 }
}
