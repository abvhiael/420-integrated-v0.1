// HC-PLACE-03: production composition of authenticated account epochs and independently
// verified world authority. Unwired services fail closed; not a client API.
import {runtimeState} from './runtime-integration.js';
const fail=x=>{throw Error('hc-place-auth:'+x)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export class HighCountryProductionPlacementAuthority {
 constructor({runtime,world,operatorRole='worldAuthority'}={}){
  if(typeof runtime?.verifyToken!=='function'||typeof runtime?.registeredPrincipal!=='function'
    ||typeof world?.verifyEvidence!=='function'||typeof world?.verifyEvent!=='function'
    ||typeof world?.canPlace!=='function'||typeof world?.validate!=='function'
    ||typeof world?.geometrySnapshot!=='function')fail('missing-independent-authorities');
  Object.assign(this,{runtime,world,operatorRole});
 }
 async registeredPrincipal(session){return this.runtime.registeredPrincipal(session)}
 async requireWorldAuthorityOperator(session,parcelId){
  const p=await this.runtime.registeredPrincipal(session),claims=this.runtime.verifyToken(session);
  if(!id(parcelId)||this.runtime.issuers[claims.iss]?.operators?.[p]?.[this.operatorRole]!==true)fail('operator-denied');
 }
 async verifyWorldEvidence(evidence){return await this.world.verifyEvidence(evidence)===true}
 async verifyWorldAuthorityEvent(event){return await this.world.verifyEvent(event)===true}
 async canPlaceOnParcel(principal,command){return await this.world.canPlace(principal,command)===true}
 async validateWorld(principal,command){return this.world.validate(principal,command)}
 async qualifiedGeometrySnapshot(principal,command){return this.world.geometrySnapshot(principal,command)}
 // Transfer gate uses BOTH authenticated principals' current durable epochs.
 verifyTransferAtCommit({senderSession,recipientSession,from,to,state,envelope,consent}){
  if(!state)return false;
  runtimeState(state);
  for(const [session,p] of [[senderSession,from],[recipientSession,to]]){
   let c;try{c=this.runtime.verifyToken(session)}catch{return false}
   if(c.sub!==p||state.runtimeAccounts.get(p)?.issuer!==c.iss
      ||(state.runtimeEpochs.get(p)??0)!==c.epoch)return false;
  }
  if(typeof this.world.verifyTransferAtCommit!=='function')return false;
  return this.world.verifyTransferAtCommit({from,to,state,envelope,consent})===true;
 }
 // Commit checks MUST be synchronous and read the locked durable runtime epoch,
 // registration state, world revision and independent authorization snapshot.
 verifyAtCommit({principal,command,authoritative,state,session,world,...rest}){
  if(!state||!authoritative||authoritative.revoked===true||!session) return false;
  let token;try{token=this.runtime.verifyToken(session)}catch{return false}
  runtimeState(state);
  if(token.sub!==principal||state.runtimeAccounts.get(principal)?.issuer!==token.iss
    ||(state.runtimeEpochs.get(principal)??0)!==token.epoch)return false;
  const current=state.placementAuthorityRevisions?.get(command.record?.parcelId??state.placementInstances?.get(command.instanceId)?.parcelId);
  if(!current||current.revoked===true||current.revision!==authoritative.revision
    ||current.evidenceId!==world.evidenceId)return false;
  if(typeof this.world.verifyAtCommit!=='function')return false;
  return this.world.verifyAtCommit({principal,command,authoritative,state,world,...rest})===true;
 }
}
