import {verifyJurisdictionAdmission,jurisdictionGates} from './jurisdiction-acceptance.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
/** Five separate external issuer lookups, with fail-closed live revocation and immutable audit receipts. */
export function createLaunchGateService({issuers,authorities,verifyJurisdiction=verifyJurisdictionAdmission,audit,clock=()=>Math.floor(Date.now()/1000)}){
 if(!issuers||!authorities||typeof audit?.append!=='function'||typeof verifyJurisdiction!=='function'||
    jurisdictionGates.some(g=>typeof issuers[g]?.resolve!=='function'||typeof issuers[g]?.checkRevocation!=='function'))fail('LAUNCH_GATE_CONFIGURATION_INVALID');
 return Object.freeze({
  async verify({request,operatorCredential}){
   if(!request||!id(request.operatorRef)||typeof operatorCredential!=='string'||!operatorCredential)fail('LAUNCH_GATE_ACCESS_DENIED');
   const records=[];
   for(const gate of jurisdictionGates){
    let proof,revocation;
    try {
     proof=await issuers[gate].resolve({request,operatorCredential});
     revocation=await issuers[gate].checkRevocation({proof,request,operatorCredential});
    }catch{fail('LAUNCH_GATE_PROVIDER_UNAVAILABLE')}
    if(!proof||proof.gate!==gate||revocation?.revoked!==false||revocation?.current!==true||
      revocation?.evidenceDigest!==proof.evidenceDigest)fail('LAUNCH_GATE_REVOKED_OR_STALE');
    records.push(proof);
   }
   const verified=verifyJurisdiction({records,authorities,request,clock});
   if(verified?.technicallyVerified!==true||verified?.productionAuthorized!==false)fail('LAUNCH_GATE_VERIFIER_INVALID');
   // Independent audit failure must block even technical positive result.
   await audit.append({kind:'liftd.launch.jurisdiction.verified',operatorRef:request.operatorRef,
    driverId:request.driverId,vehicleId:request.vehicleId,routeScopeRef:request.routeScopeRef,
    deploymentDigest:request.deploymentDigest,gates:jurisdictionGates,verifiedAt:clock()});
   return Object.freeze({technicallyVerified:true,productionAuthorized:false,gates:5});
  }
 });
}
