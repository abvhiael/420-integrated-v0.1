// HC-PLACE-03-C: trusted, serialized parcel authority provisioning and revocation.
// Caller supplies separately verified operator identity and immutable signed world evidence.
// Never expose directly to browser or guest application routes.
const fail=x=>{throw Error('hc-place-authority:'+x)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export class HighCountryPlacementAuthorityRegistry {
 constructor({store,authority}={}){
  if(typeof store?.transact!=='function'||typeof authority?.requireWorldAuthorityOperator!=='function'||typeof authority?.verifyWorldEvidence!=='function')fail('trusted-dependencies-required');
  this.store=store;this.authority=authority;
 }
 async provision(session,parcelId,evidence,expectedRevision=0){
  if(!id(parcelId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!evidence||evidence.parcelId!==parcelId||!Number.isSafeInteger(evidence.revision)||evidence.revision<=expectedRevision||!id(evidence.evidenceId)||!id(evidence.geometryQualificationId))fail('invalid-provision');
  await this.authority.requireWorldAuthorityOperator(session,parcelId);
  if(await this.authority.verifyWorldEvidence(evidence)!==true)fail('unverified-world-evidence');
  return this.store.transact(s=>{
   if(!(s.placementAuthorityRevisions instanceof Map))fail('authority-state-missing');
   const prior=s.placementAuthorityRevisions.get(parcelId);
   if((prior?.revision??0)!==expectedRevision)fail('stale-authority-revision');
   if(prior&&evidence.revision<=prior.revision)fail('non-monotonic-authority');
   const revision={revision:evidence.revision,evidenceId:evidence.evidenceId,geometryQualificationId:evidence.geometryQualificationId,revoked:false};
   s.placementAuthorityRevisions.set(parcelId,revision);
   return structuredClone(revision);
  });
 }
 async revoke(session,parcelId,expectedRevision){
  if(!id(parcelId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1||expectedRevision===Number.MAX_SAFE_INTEGER)fail('invalid-revocation');
  await this.authority.requireWorldAuthorityOperator(session,parcelId);
  return this.store.transact(s=>{
   if(!(s.placementAuthorityRevisions instanceof Map))fail('authority-state-missing');
   const prior=s.placementAuthorityRevisions.get(parcelId);
   if(!prior||prior.revision!==expectedRevision||prior.revoked===true)fail('stale-or-revoked-authority');
   const next={...prior,revision:expectedRevision+1,revoked:true};
   s.placementAuthorityRevisions.set(parcelId,next);
   return structuredClone(next);
  });
 }
}
