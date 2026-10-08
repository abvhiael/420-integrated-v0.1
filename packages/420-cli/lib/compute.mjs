const HEX32=/^0x[0-9a-fA-F]{64}$/;
function id420(value,label){if(!HEX32.test(value??''))throw new Error(label+' must be bytes32 hex');return value.toLowerCase();}
function base420(value,label){if(typeof value!=='string'||!value)throw new Error(label+' URL is required');const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw new Error(label+' URL must use http/https');return u.toString().replace(/\/$/,'');}
async function json420(response,label){let body;try{body=await response.json();}catch{throw new Error(label+' returned non-JSON');}if(!response.ok)throw new Error(label+' HTTP '+response.status+': '+String(body?.error?.message??'request failed'));return body;}
export function createComputeCliClient420({chainId,computeApi,indexer,transport=fetch}){
 if(typeof chainId!=='string'||!/^\d+$/.test(chainId)||chainId==='0')throw new Error('Compute CLI chain id invalid');
 const apiBase=computeApi?base420(computeApi,'Compute API'):null,indexerBase=indexer?base420(indexer,'420Indexer'):null;
 const request=async(base,path,init,label)=>json420(await transport(base+path,init),label);
 const read=async(path,label)=>{if(!indexerBase)throw new Error('420Indexer URL is required');const body=await request(indexerBase,path+(path.includes('?')?'&':'?')+'chainId='+encodeURIComponent(chainId),{method:'GET',headers:{accept:'application/json'}},label);if(body?.data?.authoritative===true)throw new Error(label+' returned an authoritative projection unexpectedly');return body.data;};
 return Object.freeze({
  async submit(payload){if(!apiBase)throw new Error('Compute API URL is required');if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Compute submission payload must be an object');if(payload.chainId!==chainId)throw new Error('Compute submission chain identity mismatch');const body=await request(apiBase,'/v1/compute/jobs',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)},'Compute API');const plan=body?.data;if(!plan||plan.status!=='READY_FOR_WALLET_AUTHORIZATION'||plan.canonicalState!==false||plan.secretMaterialManaged!==false||plan.intent?.requiresWalletAuthorization!==true)throw new Error('Compute API returned unsafe submission plan');return plan;},
  worker:(workerId)=>read('/v1/compute/workers/'+id420(workerId,'workerId'),'Compute worker'),
  status:(jobId)=>read('/v1/compute/jobs/'+id420(jobId,'jobId'),'Compute job'),
  async verify(jobId){const data=await read('/v1/compute/jobs/'+id420(jobId,'jobId'),'Compute verification');return{jobId:data.jobId,status:data.status,verifier:data.verifier??null,verificationRef:data.verificationRef??null,approved:data.approved??null,authoritative:false};},
  rewards:(rewardId)=>read('/v1/compute/rewards/'+id420(rewardId,'rewardId'),'Compute reward')
 });
}
