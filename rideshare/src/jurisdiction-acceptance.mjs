import {verify as verifySignature} from 'node:crypto';
const fail=c=>{throw Object.assign(new Error(c),{code:c})};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const jurisdictionGates=Object.freeze(['passenger_transport','driver','vehicle','insurance','service_area']);
const signedKeys=Object.freeze(['gate','country','region','municipality','service','operatorRef','driverId','vehicleId','policyRef','routeScopeRef','issuer','issuedAt','expiresAt','revoked','approved','evidenceDigest','deploymentDigest']);
/** Verifies cryptographic *technical* attestations. Issuers must be independently established as legally authorized by the operator. */
export function verifyJurisdictionAdmission({records,authorities,request,clock=()=>Math.floor(Date.now()/1000)}){
 const now=clock();
 if(!Number.isSafeInteger(now)||now<0||!Array.isArray(records)||records.length!==5||
 !authorities||typeof authorities!=='object'||!request||!id(request.operatorRef)||!id(request.driverId)||
 !id(request.vehicleId)||!id(request.routeScopeRef)||!sha(request.deploymentDigest)||
 request.country!=='CA'||request.region!=='BC'||request.municipality!=='Vancouver'||
 request.service!=='liftd-passenger')fail('JURISDICTION_ADMISSION_DENIED');
 const verified=new Set();
 for(const x of records){
  if(!x||!jurisdictionGates.includes(x.gate)||verified.has(x.gate)||!id(x.issuer)||
   x.country!==request.country||x.region!==request.region||x.municipality!==request.municipality||
   x.service!==request.service||x.operatorRef!==request.operatorRef||
   x.driverId!==request.driverId||x.vehicleId!==request.vehicleId||
   x.routeScopeRef!==request.routeScopeRef||x.deploymentDigest!==request.deploymentDigest||
   !id(x.policyRef)||!sha(x.evidenceDigest)||x.approved!==true||x.revoked!==false||
   !Number.isSafeInteger(x.issuedAt)||x.issuedAt>now||
   !Number.isSafeInteger(x.expiresAt)||x.expiresAt<=now||x.expiresAt-x.issuedAt>86400||
   typeof x.signature!=='string'||!/^[A-Za-z0-9_-]+$/.test(x.signature))
   fail('JURISDICTION_ADMISSION_DENIED');
  const authority=authorities[x.gate];
  if(!authority||authority.issuer!==x.issuer||authority.independentlyApproved!==true||!authority.publicKey)
   fail('JURISDICTION_AUTHORITY_UNVERIFIED');
  const encoded=Buffer.from(JSON.stringify(signedKeys.map(k=>x[k])));
  let valid=false;
  try{valid=verifySignature(null,encoded,authority.publicKey,Buffer.from(x.signature,'base64url'))}catch{}
  if(!valid)fail('JURISDICTION_SIGNATURE_INVALID');
  verified.add(x.gate);
 }
 if(verified.size!==jurisdictionGates.length)fail('JURISDICTION_ADMISSION_DENIED');
 return Object.freeze({technicallyVerified:true,productionAuthorized:false,scope:'Vancouver-BC',gates:verified.size});
}
