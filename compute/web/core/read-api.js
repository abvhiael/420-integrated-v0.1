const HEX32=/^0x[0-9a-fA-F]{64}$/;const ACCOUNT=/^0x[0-9a-fA-F]{40}$/;
function id(v,n){if(typeof v!=='string'||!HEX32.test(v))throw new Error(n+' must be bytes32 hex');return v.toLowerCase();}
function account(v,n){if(typeof v!=='string'||!ACCOUNT.test(v))throw new Error(n+' must be an address');return v.toLowerCase();}
function assertProjection(v){if(v&&typeof v==='object'&&v.authoritative===true)throw new Error('authoritative projection rejected');return v;}
export function createComputeReadApi420(config,fetchImpl=fetch){const base=config.indexerUrl,chain=config.chainId;const requireRuntime=()=>{if(!config.runtimeReady||!base)throw new Error('canonical Compute read runtime is not resolved');};async function get(path,params={}){requireRuntime();const u=new URL(base+path);u.searchParams.set('chainId',chain);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const r=await fetchImpl(u,{headers:{accept:'application/json'}});let b;try{b=await r.json();}catch{throw new Error('Indexer returned non-JSON');}if(!r.ok)throw new Error('Indexer HTTP '+r.status+': '+String(b?.error?.message??'request failed'));const data=b?.data;if(Array.isArray(data?.items))data.items.forEach(assertProjection);else assertProjection(data);return data;}
return Object.freeze({
 health:async()=>{requireRuntime();const r=await fetchImpl(base+'/health',{headers:{accept:'application/json'}});if(!r.ok)throw new Error('Indexer health HTTP '+r.status);return (await r.json()).data;},
 status:()=>get('/v1/status'),
 jobs:(owner,limit=50)=>get('/v1/compute/jobs',{owner:account(owner,'owner'),limit}),
 job:(jobId)=>get('/v1/compute/jobs/'+id(jobId,'jobId')),
 workers:(operator,limit=50)=>get('/v1/compute/workers',{operator:account(operator,'operator'),limit}),
 worker:(workerId)=>get('/v1/compute/workers/'+id(workerId,'workerId')),
 verifiers:(authority,limit=50)=>get('/v1/compute/verifiers',{authority:account(authority,'authority'),limit}),
 verifier:(verifierId)=>get('/v1/compute/verifiers/'+id(verifierId,'verifierId')),
 projects:(owner,limit=50)=>get('/v1/compute/research/projects',{owner:account(owner,'owner'),limit}),
 project:(projectId)=>get('/v1/compute/research/projects/'+id(projectId,'projectId')),
 rewards:(beneficiary,limit=100)=>get('/v1/compute/rewards',{beneficiary:account(beneficiary,'beneficiary'),limit}),
 reputation:(workerId,limit=50)=>get('/v1/compute/workers/'+id(workerId,'workerId')+'/reputation',{limit}),
 stake:(workerId,limit=50)=>get('/v1/compute/workers/'+id(workerId,'workerId')+'/stake',{limit})
});}
