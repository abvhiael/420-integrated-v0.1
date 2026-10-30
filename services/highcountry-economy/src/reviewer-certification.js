// HC-ECON-05: server-owned reviewer authority, exact-revision certificates and QA.
import {createPublicKey,verify as verifySignature,createHash} from 'node:crypto';
export const CERT_VERSION='HC.ECON.CERT.V1';
const fail=m=>{throw new Error('hc-econ-05:'+m);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const clone=x=>structuredClone(x);
const state=s=>{for(const k of ['econReviewers','econAssignments','econCertificates','econReviewAudit','econReviewAppeals'])s[k]??=new Map();};
const canonical=x=>JSON.stringify(x);
const payload=x=>({version:CERT_VERSION,certificateId:x.certificateId,assignmentId:x.assignmentId,reviewerId:x.reviewerId,assetId:x.assetId,revision:x.revision,sha256:x.sha256,metadataHash:x.metadataHash,description:x.description,issuedAt:x.issuedAt});
export function verifyCertificateSignature(certificate,publicKey){
 try{return certificate?.version===CERT_VERSION&&typeof certificate.signature==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(certificate.signature)&&verifySignature(null,Buffer.from(canonical(payload(certificate))),createPublicKey(publicKey),Buffer.from(certificate.signature,'base64'))===true;}catch{return false;}
}
const audit=(s,type,actor,target,now,detail={})=>{const key=String(s.econReviewAudit.size+1);s.econReviewAudit.set(key,{sequence:Number(key),type,actor,target,at:now,...clone(detail)});};
function requiredAsset(s,assetId,revision){const a=s.econCreatorAssets?.get(JSON.stringify([assetId,revision]));if(!a||!hash(a.sha256)||!hash(a.metadataHash)||a.publicationStatus!=='unpublished')fail('immutable-asset-required');return a;}
function valid(s,cert,design){
 if(!cert||cert.status!=='approved'||cert.version!==CERT_VERSION||!verifyCertificateSignature(cert, s.econReviewers.get(cert.reviewerId)?.publicKey))return false;
 const reviewer=s.econReviewers.get(cert.reviewerId),assignment=s.econAssignments.get(cert.assignmentId);
 if(!reviewer||reviewer.status!=='active'||reviewer.keyVersion!==cert.keyVersion||!assignment||assignment.reviewerId!==cert.reviewerId||assignment.assetId!==cert.assetId||assignment.revision!==cert.revision||assignment.status!=='completed')return false;
 const asset=s.econCreatorAssets?.get(JSON.stringify([cert.assetId,cert.revision]));
 if(!asset||asset.sha256!==cert.sha256||asset.metadataHash!==cert.metadataHash||asset.creatorId!==design.creator)return false;
 if(cert.assetId!==design.designId||cert.certificateId!==design.certificationRef||!cert.automatedValidationId||!id(cert.qaBy)||cert.qaBy===cert.reviewerId||cert.disputed===true)return false;
 return true;
}
export function assertCertifiedForIssuance(s,design){
 if(design.origin!=='creator')return true;
 state(s);const cert=s.econCertificates.get(design.certificationRef);
 if(!valid(s,cert,design))fail('certification-not-authorized');
 return true;
}
export class ReviewerCertification {
 constructor({store,authority,automation,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof authority?.principal!=='function'||typeof authority?.guardState!=='function'||typeof automation?.verify!=='function')fail('dependencies');
  Object.assign(this,{store,authority,automation,clock});
 }
 async actor(session){const p=await this.authority.principal(session);if(!id(p))fail('principal');return p;}
 guard(s,session,scope,principal){if(this.authority.guardState(s,session,scope,principal)!==true)fail('authority-revoked');}
 async register(session,{reviewerId,publicKey}){
  const actor=await this.actor(session);if(!id(reviewerId)||typeof publicKey!=='string')fail('registration');
  let key;try{key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')fail('key-type');}catch{fail('key-invalid');}
  return this.store.transact(s=>{state(s);this.guard(s,session,'reviewer-register',actor);if(s.econReviewers.has(reviewerId))fail('registered');
   const row={reviewerId,publicKey:key.export({type:'spki',format:'pem'}),keyVersion:1,status:'active',warnings:0,registeredAt:this.clock()};
   s.econReviewers.set(reviewerId,row);audit(s,'registered',actor,reviewerId,this.clock());return clone(row);
  });
 }
 async assign(session,{assignmentId,reviewerId,assetId,revision}){
  const actor=await this.actor(session);if(![assignmentId,reviewerId,assetId].every(id)||!Number.isSafeInteger(revision)||revision<1)fail('assignment');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-assign',actor);
   const reviewer=s.econReviewers.get(reviewerId),asset=requiredAsset(s,assetId,revision);
   if(!reviewer||reviewer.status!=='active'||reviewerId===asset.creatorId||s.econAssignments.has(assignmentId))fail('assignment-denied');
   const row={assignmentId,reviewerId,assetId,revision,sha256:asset.sha256,metadataHash:asset.metadataHash,status:'assigned',assignedBy:actor,assignedAt:this.clock()};
   s.econAssignments.set(assignmentId,row);audit(s,'assigned',actor,assignmentId,this.clock());return clone(row);
  });
 }
 async certify(session,certificate,automatedEvidence){
  const actor=await this.actor(session);
  if(!certificate||![certificate.certificateId,certificate.assignmentId,certificate.reviewerId,certificate.assetId].every(id)||certificate.reviewerId!==actor||
   !Number.isSafeInteger(certificate.revision)||certificate.revision<1||!hash(certificate.sha256)||!hash(certificate.metadataHash)||
   typeof certificate.description!=='string'||certificate.description.trim().length<12||certificate.description.length>4096||
   !Number.isSafeInteger(certificate.issuedAt)||certificate.issuedAt<1||certificate.version!==CERT_VERSION)fail('certificate-input');
  const verified=await this.automation.verify({assetId:certificate.assetId,revision:certificate.revision,sha256:certificate.sha256,metadataHash:certificate.metadataHash},automatedEvidence);
  if(verified?.valid!==true||!id(verified.evidenceId))fail('automation-rejected');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-certify',actor);
   const assignment=s.econAssignments.get(certificate.assignmentId),reviewer=s.econReviewers.get(actor),asset=requiredAsset(s,certificate.assetId,certificate.revision);
   if(!reviewer||reviewer.status!=='active'||!assignment||assignment.status!=='assigned'||assignment.reviewerId!==actor||assignment.assetId!==certificate.assetId||
     assignment.revision!==certificate.revision||assignment.sha256!==certificate.sha256||assignment.metadataHash!==certificate.metadataHash||
     asset.sha256!==certificate.sha256||asset.metadataHash!==certificate.metadataHash||s.econCertificates.has(certificate.certificateId)||
     [...s.econCertificates.values()].some(c=>c.assignmentId===certificate.assignmentId))fail('certificate-conflict');
   if(!verifyCertificateSignature(certificate,reviewer.publicKey))fail('invalid-signature');
   const row={...clone(certificate),keyVersion:reviewer.keyVersion,automatedValidationId:verified.evidenceId,status:'pending-qa',qaBy:null,disputed:false,certifiedAt:this.clock()};
   s.econCertificates.set(row.certificateId,row);assignment.status='completed';audit(s,'signed',actor,row.certificateId,this.clock(),{assetId:row.assetId,revision:row.revision});
   return clone(row);
  });
 }
 async qa(session,certificateId,decision,reason){
  const actor=await this.actor(session);if(!id(certificateId)||!['approve','reject','revoke'].includes(decision)||typeof reason!=='string'||reason.trim().length<3)fail('qa-input');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-qa',actor);const c=s.econCertificates.get(certificateId);
   if(!c||c.reviewerId===actor|| (decision==='revoke'?c.status!=='approved':c.status!=='pending-qa'))fail('qa-denied');
   c.status=decision==='approve'?'approved':decision==='revoke'?'revoked':'rejected';c.qaBy=actor;c.qaAt=this.clock();
   audit(s,'qa-'+decision,actor,certificateId,this.clock(),{reason});return clone(c);
  });
 }
 async discipline(session,reviewerId,action,reason){
  const actor=await this.actor(session);if(!id(reviewerId)||!['warn','suspend','reinstate','revoke'].includes(action)||typeof reason!=='string'||reason.trim().length<3)fail('discipline-input');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-discipline',actor);const r=s.econReviewers.get(reviewerId);if(!r||actor===reviewerId||r.status==='revoked'&&action!=='revoke')fail('discipline-denied');
   if(action==='warn'){if(r.status!=='active')fail('warning-inactive');r.warnings++;}
   else if(action==='suspend')r.status='suspended';else if(action==='reinstate'){if(r.status!=='suspended')fail('not-suspended');r.status='active';}else r.status='revoked';
   audit(s,'discipline-'+action,actor,reviewerId,this.clock(),{reason,warnings:r.warnings});return clone(r);
  });
 }
 async dispute(session,certificateId,appealId,reason){
  const actor=await this.actor(session);if(![certificateId,appealId].every(id)||typeof reason!=='string'||reason.trim().length<3)fail('dispute-input');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-dispute',actor);const c=s.econCertificates.get(certificateId);
   if(!c||s.econReviewAppeals.has(appealId)||[...s.econReviewAppeals.values()].some(a=>a.certificateId===certificateId&&a.status==='open'))fail('dispute-denied');
   c.disputed=true;const a={appealId,certificateId,actor,reason,status:'open',openedAt:this.clock()};s.econReviewAppeals.set(appealId,a);
   audit(s,'disputed',actor,certificateId,this.clock(),{appealId});return clone(a);
  });
 }
 async resolve(session,appealId,decision,reason){
  const actor=await this.actor(session);if(!id(appealId)||!['uphold','restore'].includes(decision)||typeof reason!=='string'||reason.trim().length<3)fail('appeal-input');
  return this.store.transact(s=>{state(s);this.guard(s,session,'review-appeal',actor);const a=s.econReviewAppeals.get(appealId),c=s.econCertificates.get(a?.certificateId);
   if(!a||a.status!=='open'||!c||actor===c.reviewerId||actor===a.actor)fail('appeal-denied');
   a.status='resolved';a.decision=decision;a.decidedBy=actor;a.decidedAt=this.clock();
   if(decision==='uphold')c.status='revoked';else if(c.status==='approved')c.disputed=false;
   audit(s,'appeal-'+decision,actor,a.certificateId,this.clock(),{appealId,reason});return clone(a);
  });
 }
}
