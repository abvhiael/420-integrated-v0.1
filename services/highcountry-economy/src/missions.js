// HC-NEXT-5.2: ordinary registered-player missions. No chain mint, custody or canonical asset writer.
import {SettlementError} from './buds-ledger.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const uint=x=>Number.isSafeInteger(x)&&x>=0;
const allowedRewards=new Set(['journal-badge','archive-note','cosmetic-token','mission-xp']);
export function validateMissionCatalog(c){
 if(!c||!valid(c.version)||!Array.isArray(c.missions)||!c.missions.length||c.missions.length>128)
  throw new SettlementError('invalid mission catalog');
 const seen=new Set();
 const missions=c.missions.map(m=>{
  if(!m||!valid(m.id)||seen.has(m.id)||!valid(m.objective)||!uint(m.target)||!m.target
   ||m.target>100000||!uint(m.maxPerEvidence)||!m.maxPerEvidence||m.maxPerEvidence>m.target
   ||!uint(m.durationMs)||m.durationMs<1000||m.durationMs>31536000000
   ||!Array.isArray(m.prerequisites)||m.prerequisites.some(p=>!valid(p)||!seen.has(p))
   ||!m.reward||!allowedRewards.has(m.reward.type)||!uint(m.reward.amount)
   ||!m.reward.amount||m.reward.amount>10000)
   throw new SettlementError('invalid mission definition');
  seen.add(m.id);
  return Object.freeze({...m,prerequisites:Object.freeze([...m.prerequisites]),
   reward:Object.freeze({...m.reward})});
 });
 return Object.freeze({version:c.version,missions:Object.freeze(missions)});
}
export class MissionService {
 constructor({store,identity,catalog,verifyEvidence,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof verifyEvidence!=='function'||typeof clock!=='function')
   throw new SettlementError('mission authority not configured');
  Object.assign(this,{store,identity,verifyEvidence,clock});
  this.catalog=validateMissionCatalog(catalog);
 }
 _state(s){s.missions??=new Map();s.missionProofs??=new Set();s.missionRewards??=new Map();}
 _session(s,session,principal){
  if(typeof this.identity.verifyToken!=='function')return;
  const claims=this.identity.verifyToken(session);
  if(claims?.sub!==principal||!Number.isSafeInteger(claims.epoch)
    ||(s.runtimeEpochs?.get(principal)??0)!==claims.epoch)
   throw new SettlementError('mission session revoked');
 }
 async _principal(session){
  const principal=await this.identity.registeredPrincipal(session);
  if(!valid(principal))throw new SettlementError('registered player required');
  return principal;
 }
 _definition(id){const def=this.catalog.missions.find(m=>m.id===id);
  if(!def)throw new SettlementError('unknown mission');return def;}
 _key(principal,id){return JSON.stringify([principal,this.catalog.version,id]);}
 _clock(){const now=this.clock();if(!uint(now))throw new SettlementError('invalid mission clock');return now;}
 async snapshot(session){
  const principal=await this._principal(session),now=this._clock();
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   return {version:this.catalog.version,missions:this.catalog.missions.map(m=>{
    const r=s.missions.get(this._key(principal,m.id));
    const state=r?.state==='active'&&now>=r.deadline?'expired':r?.state??'available';
    return {id:m.id,objective:m.objective,target:m.target,prerequisites:m.prerequisites,
     reward:m.reward,state,progress:r?.progress??0,deadline:r?.deadline??null,
     rewardClaimed:r?.rewardClaimed??false};
   }),rewards:[...(s.missionRewards.get(principal)??[])]};
  });
 }
 async activate(session,operation,id){
  const principal=await this._principal(session),def=this._definition(id),now=this._clock();
  if(!valid(operation))throw new SettlementError('invalid mission operation');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const key=this._key(principal,id);
   if(s.missions.has(key))throw new SettlementError('mission already activated');
   for(const pre of def.prerequisites)
    if(!['complete','claimed'].includes(s.missions.get(this._key(principal,pre))?.state))
     throw new SettlementError('mission prerequisite missing');
   if(now+def.durationMs>Number.MAX_SAFE_INTEGER)throw new SettlementError('mission deadline overflow');
   const r={state:'active',progress:0,startedAt:now,deadline:now+def.durationMs,
    rewardClaimed:false,proofs:[]};
   s.missions.set(key,r);s.operations.add(operation);
   return {id,version:this.catalog.version,...r};
  });
 }
 async progress(session,operation,id,evidence,amount){
  const principal=await this._principal(session),def=this._definition(id),now=this._clock();
  if(!valid(operation)||typeof evidence!=='string'||!evidence||evidence.length>8192
    ||!uint(amount)||!amount||amount>def.maxPerEvidence)
   throw new SettlementError('invalid mission evidence request');
  const verified=await this.verifyEvidence({principal,missionId:id,version:this.catalog.version,
   objective:def.objective,evidence,amount});
  if(!verified||!valid(verified.sourceEvent))throw new SettlementError('authenticated mission evidence required');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const key=this._key(principal,id),r=s.missions.get(key);
   if(!r||r.state!=='active'||now>=r.deadline)throw new SettlementError('mission not active');
   if(s.missionProofs.has(verified.sourceEvent))throw new SettlementError('replayed mission evidence');
   if(r.progress+amount>def.target)throw new SettlementError('mission progress capped');
   r.progress+=amount;r.proofs.push(verified.sourceEvent);
   s.missionProofs.add(verified.sourceEvent);s.operations.add(operation);
   if(r.progress===def.target){r.state='complete';r.completedAt=now;}
   return {id,version:this.catalog.version,state:r.state,progress:r.progress,target:def.target};
  });
 }
 async claim(session,operation,id){
  const principal=await this._principal(session),def=this._definition(id),now=this._clock();
  if(!valid(operation))throw new SettlementError('invalid claim operation');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const r=s.missions.get(this._key(principal,id));
   if(!r||r.state!=='complete'||now>=r.deadline||r.rewardClaimed)
    throw new SettlementError('mission reward unavailable');
   r.state='claimed';r.rewardClaimed=true;r.claimedAt=now;
   const rewards=s.missionRewards.get(principal)??[];
   rewards.push({missionId:id,version:this.catalog.version,...def.reward,claimedAt:now});
   s.missionRewards.set(principal,rewards);s.operations.add(operation);
   return {id,status:'claimed',reward:def.reward};
  });
 }
 async cancel(session,operation,id){
  const principal=await this._principal(session);
  if(!valid(operation))throw new SettlementError('invalid mission operation');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const r=s.missions.get(this._key(principal,id));
   if(!r||r.state!=='active')throw new SettlementError('mission cannot be cancelled');
   r.state='cancelled';s.operations.add(operation);
   return {id,state:r.state};
  });
 }
 async expire(session,operation,id){
  const principal=await this._principal(session),now=this._clock();
  if(!valid(operation))throw new SettlementError('invalid mission operation');
  return this.store.transact(s=>{
   this._state(s);this._session(s,session,principal);
   if(s.operations.has(operation))throw new SettlementError('replayed operation');
   const r=s.missions.get(this._key(principal,id));
   if(!r||!['active','complete'].includes(r.state)||now<r.deadline)
    throw new SettlementError('mission not expirable');
   r.state='expired';s.operations.add(operation);return {id,state:r.state};
  });
 }
}
