const HEX=/^[a-f0-9]{64}$/;
export function normalizeScienceObservations420(response,{chainId,max=50,now=Date.now()}={}){
 if(response?.schemaVersion!=='420-science-read-v1'||response.chainId!==chainId||response.authoritative!==false||response.rewardEligible!==false||!Array.isArray(response.items)||response.items.length>max)throw Error('untrusted external science response');
 return response.items.map(x=>{
  if(x.chainId!==chainId||!['BOINC','FOLDING_AT_HOME'].includes(x.provider)||!HEX.test(x.workKey)||!['UNVERIFIED','PENDING','VERIFIED','REVOKED'].includes(x.eligibility)||!['FINALIZED','UNFINALIZED'].includes(x.finality)||typeof x.project!=='string'||x.project.length>100||!['BOINC_CREDIT','FOLDING_POINTS'].includes(x.creditUnit)||!/^(0|[1-9][0-9]{0,17})$/.test(x.creditedEvent)||x.authoritative!==false||x.rewardEligible!==false||x.amount420!==null||!Number.isSafeInteger(x.observedAt)||x.observedAt<=0)throw Error('untrusted science item');
  const stale=now-x.observedAt>86400000||x.stale===true;
  return Object.freeze({project:x.project,provider:x.provider,credit:x.creditedEvent,unit:x.creditUnit,status:stale?'STALE':x.eligibility,finality:x.finality,ageMs:Math.max(0,now-x.observedAt),reward:'No $420 entitlement',authoritative:false});
 });
}
