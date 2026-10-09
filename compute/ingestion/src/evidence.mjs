import { createPublicKey, verify as verifySignature, createHash } from 'node:crypto';
export class EvidenceError extends Error { constructor(code){ super(code); this.code=code; } }
const reject=code=>{throw new EvidenceError(code)};
const isHash=v=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
const isName=v=>typeof v==='string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(v);
const digest=b=>createHash('sha256').update(b).digest('hex');
export function receiptBytes(p){
 const keys=['schema','sourceId','projectId','contributorCommitment','assignmentCommitment','workUnitCommitment','resultCommitment','acceptanceCommitment','creditAmount','creditUnit','issuedAt','acceptedAt','observedAt','expiresAt','revision','status'];
 if(!p||Object.keys(p).sort().join()!==[...keys].sort().join()||p.schema!=='420-s03-source-receipt-v1')reject('SCHEMA');
 if(!isName(p.sourceId)||!isName(p.projectId)||!isName(p.creditUnit))reject('SCHEMA');
 for(const field of ['contributorCommitment','assignmentCommitment','workUnitCommitment','resultCommitment','acceptanceCommitment'])if(!isHash(p[field]))reject('MISSING_WORK_UNIT');
 if(typeof p.creditAmount!=='string'||!/^(0|[1-9][0-9]{0,17})$/.test(p.creditAmount)||BigInt(p.creditAmount)>BigInt(Number.MAX_SAFE_INTEGER))reject('CREDIT');
 if(![p.issuedAt,p.acceptedAt,p.observedAt,p.expiresAt].every(x=>Number.isSafeInteger(x)&&x>0)||p.issuedAt>p.acceptedAt||p.acceptedAt>p.observedAt||p.observedAt>=p.expiresAt)reject('TIME');
 if(!Number.isSafeInteger(p.revision)||p.revision<1||!['ACCEPTED','CORRECTED','REVOKED'].includes(p.status))reject('REVISION');
 return Buffer.from('420/CMP/S03/V1'+String.fromCharCode(10)+keys.map(k=>JSON.stringify(p[k])).join(String.fromCharCode(10)));
}
export function makeVerifier({sources=[],now=()=>Date.now()}={}){
 const approved=new Map(),hist=new Map();
 for(const s of sources){
  if(!s?.approved||!s?.permissionApproved||!isName(s.sourceId)||!isName(s.projectId)||!isName(s.creditUnit)||!Number.isSafeInteger(s.maxCredit)||s.maxCredit<0)reject('UNAPPROVED');
  let key;try{key=createPublicKey(s.publicKeyPem)}catch{reject('PUBLIC_KEY')}
  if(key.asymmetricKeyType!=='ed25519')reject('PUBLIC_KEY');
  const id=s.sourceId+'|'+s.projectId;if(approved.has(id))reject('DUPLICATE_SOURCE');
  approved.set(id,{...s,key,active:true});
 }
 return {
  verify(p,sig){
   const bytes=receiptBytes(p),source=approved.get(p.sourceId+'|'+p.projectId),nowMs=now();
   if(!source?.active)reject('SOURCE_UNAVAILABLE');
   if(!Number.isSafeInteger(nowMs)||p.observedAt>nowMs+300000||nowMs-p.observedAt>86400000||p.expiresAt<=nowMs)reject('STALE');
   if(source.creditUnit!==p.creditUnit||BigInt(p.creditAmount)>BigInt(source.maxCredit))reject('CREDIT_POLICY');
   if(typeof sig!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(sig))reject('SIGNATURE');
   const sb=Buffer.from(sig,'base64url');if(sb.length!==64||!verifySignature(null,bytes,source.key,sb))reject('INVALID_SIGNATURE');
   const id=digest([p.sourceId,p.projectId,p.assignmentCommitment,p.workUnitCommitment].join('|'));
   const receiptHash=digest(Buffer.concat([bytes,sb])),last=hist.get(id);
   if(last && p.revision<last.revision)reject('STALE_REVISION');
   if(last && p.revision===last.revision){if(receiptHash===last.receiptHash)return {...last.value};reject('CONFLICTING_REVISION');}
   if(last?.value.status==='REVOKED' && p.status!=='REVOKED')reject('REVOKED_FINAL');
   const value={schema:'420-s03-observation-v1',sourceId:p.sourceId,projectId:p.projectId,workKey:id,receiptHash,status:p.status,revision:p.revision,creditUnit:p.creditUnit,creditAmount:p.creditAmount,expiresAt:p.expiresAt,sourceVerified:p.status!=='REVOKED',canonicalAttestation:false,rewardEligible:false,authoritative:false};
   hist.set(id,{revision:p.revision,receiptHash,value});return {...value};
  },
  suspend(sourceId,projectId){const s=approved.get(sourceId+'|'+projectId);if(!s)reject('SOURCE_UNAVAILABLE');s.active=false;},
  view(workKey){const h=hist.get(workKey);if(!h)return null;const s=approved.get(h.value.sourceId+'|'+h.value.projectId);return {...h.value,sourceVerified:!!s?.active && h.value.status!=='REVOKED' && h.value.expiresAt>now(),rewardEligible:false};}
 };
}
