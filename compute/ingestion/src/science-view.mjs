import {createHash} from 'node:crypto';
export class ScienceViewError extends Error{constructor(code){super(code);this.code=code}}
const bad=c=>{throw new ScienceViewError(c)};
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const safe=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(x);
const digest=x=>createHash('sha256').update(x).digest('hex');
export function makeScienceReadModel({chainId,clock=()=>Date.now(),limitMax=100}){
 if(!safe(chainId)||!Number.isInteger(limitMax)||limitMax<1||limitMax>100)bad('CONFIG');
 const observations=new Map(),proofs=new Map(),claims=new Map();let head=null;
 const key=(provider,project,work)=>[chainId,provider,project,work].join('|');
 const identity=x=>{if(!x||!['BOINC','FOLDING_AT_HOME'].includes(x.provider)||!safe(x.project)||!hex(x.workKey)||x.chainId!==chainId)bad('IDENTITY');return key(x.provider,x.project,x.workKey)};
 const validDate=t=>Number.isSafeInteger(t)&&t>0&&t<clock()+300000;
 return Object.freeze({
  ingestObservation(x){
   const k=identity(x);if(x.authoritative!==false||x.rewardEligible!==false||!safe(x.creditUnit)||!/^(0|[1-9][0-9]{0,17})$/.test(x.creditAmount)||!validDate(x.observedAt)||!hex(x.sourceReceiptHash))bad('SOURCE_OBSERVATION');
   const old=observations.get(k);if(old&&x.observedAt<old.observedAt)bad('STALE_SOURCE');
   if(old&&x.observedAt===old.observedAt&&x.sourceReceiptHash!==old.sourceReceiptHash)bad('CONFLICTING_OBSERVATION');
   const v=Object.freeze({chainId,provider:x.provider,project:x.project,workKey:x.workKey,creditUnit:x.creditUnit,creditAmount:x.creditAmount,observedAt:x.observedAt,sourceReceiptHash:x.sourceReceiptHash,sourceStatus:x.sourceStatus==='REVOKED'?'REVOKED':'UNVERIFIED',authoritative:false,rewardEligible:false});
   observations.set(k,v);return {...v};
  },
  projectCanonical(x){
   const k=identity(x);if(!hex(x.canonicalWorkCommitment)||!hex(x.attestationId)||!['PENDING','VERIFIED','REVOKED'].includes(x.status)||x.authoritative!==false||!validDate(x.indexedAt)||x.finalized!==true&&x.finalized!==false)bad('CANONICAL_PROJECTION');
   const old=proofs.get(k);if(old&&old.finalized&&x.indexedAt<old.indexedAt)bad('STALE_CANONICAL');
   const v=Object.freeze({chainId,provider:x.provider,project:x.project,workKey:x.workKey,canonicalWorkCommitment:x.canonicalWorkCommitment,attestationId:x.attestationId,status:x.status,indexedAt:x.indexedAt,finalized:x.finalized,authoritative:false});
   proofs.set(k,v);return {...v};
  },
  claimState(x){
   if(x.chainId!==chainId||!hex(x.canonicalWorkCommitment)||typeof x.consumed!=='boolean'||x.finalized!==true&&x.finalized!==false||!validDate(x.indexedAt))bad('CLAIM_PROJECTION');
   claims.set(x.canonicalWorkCommitment,Object.freeze({consumed:x.consumed,finalized:x.finalized,indexedAt:x.indexedAt}));return {consumed:x.consumed,authoritative:false};
  },
  rollback({indexedAfter}){if(!Number.isSafeInteger(indexedAfter)||indexedAfter<0)bad('ROLLBACK');for(const [k,v] of proofs)if(v.indexedAt>indexedAfter)proofs.delete(k);for(const [k,v] of claims)if(v.indexedAt>indexedAfter)claims.delete(k);head=indexedAfter;},
  page({limit=25,provider=null,project=null}={}){
   if(!Number.isSafeInteger(limit)||limit<1||limit>limitMax||provider&&!['BOINC','FOLDING_AT_HOME'].includes(provider)||project&&!safe(project))bad('PAGE');
   const rows=[];
   for(const [k,o] of observations){if(provider&&o.provider!==provider||project&&o.project!==project)continue;const c=proofs.get(k),claim=c&&claims.get(c.canonicalWorkCommitment);const stale=clock()-o.observedAt>86400000;
    const state=o.sourceStatus==='REVOKED'||c?.status==='REVOKED'?'REVOKED':!c?'UNVERIFIED':c.status==='VERIFIED'&&c.finalized&&!stale?'VERIFIED':'PENDING';
    rows.push(Object.freeze({chainId,project:o.project,provider:o.provider,workKey:o.workKey,creditUnit:o.creditUnit,creditedEvent:o.creditAmount,observedAt:o.observedAt,ageMs:Math.max(0,clock()-o.observedAt),stale,eligibility:state,finality:c?.finalized?'FINALIZED':'UNFINALIZED',claimConsumed:claim?.consumed??null,authoritative:false,rewardEligible:false,amount420:null}));
   }
   rows.sort((a,b)=>b.observedAt-a.observedAt||a.workKey.localeCompare(b.workKey));
   return Object.freeze({schemaVersion:'420-science-read-v1',chainId,head,items:rows.slice(0,limit),total:rows.length,authoritative:false,rewardEligible:false});
  }
 });
}
