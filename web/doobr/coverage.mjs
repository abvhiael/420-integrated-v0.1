// R03.2 informational public coverage: no client-side policy authority.
export const STATES=Object.freeze(['AVAILABLE','LIMITED','UNAVAILABLE','UNKNOWN']);
export function coverageResult(region,projection,now=new Date()){
  if(!['VANCOUVER'].includes(region))return Object.freeze({state:'UNKNOWN',message:'Coverage for this region has not been verified.'});
  // Until independent approvals and server-side public verification, never advertise service.
  if(!projection || projection.operationally_authorized!==true)return Object.freeze({state:'UNKNOWN',message:'DOOBr is not accepting delivery orders. Coverage cannot be verified.'});
  if(projection.region_code!==region || !STATES.includes(projection.availability) ||
     !Number.isFinite(Date.parse(projection.expires_at)) || Date.parse(projection.expires_at)<=now.getTime() ||
     typeof projection.policy_version!=='string' || !projection.policy_version.trim())
     return Object.freeze({state:'UNKNOWN',message:'Coverage information is unavailable.'});
  // This informational site is not permitted to activate regulated service.
  return Object.freeze({state:'UNKNOWN',message:'Coverage information does not establish legal delivery eligibility.'});
}
