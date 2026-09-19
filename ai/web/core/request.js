const B32=/^0x[0-9a-fA-F]{64}$/;
const workloads=new Set(['TEXT','MULTIMODAL','IMAGE','AUDIO','VIDEO','EMBEDDING','RERANK','FINE_TUNE','BATCH']);
export function buildAIRequestDraft(input,now=Math.floor(Date.now()/1000)){
 const required=['jobId','modelVersionId','workloadClass','requestHash','privacyPolicyId','verificationProfileId'];
 for(const k of required) if(!input[k]) throw new Error(`${k} is required`);
 for(const k of ['jobId','modelVersionId','requestHash','privacyPolicyId','verificationProfileId']) if(!B32.test(input[k])) throw new Error(`${k} must be bytes32`);
 if(!workloads.has(input.workloadClass)) throw new Error('unsupported workload class');
 if(!/^\d+$/.test(String(input.maxSpend420))||BigInt(input.maxSpend420)<=0n) throw new Error('maxSpend420 must be positive integer units');
 const deadline=Number(input.deadline); if(!Number.isSafeInteger(deadline)||deadline<=now) throw new Error('deadline must be in the future');
 return Object.freeze({kind:'AIJobManager.createRequest',...input,maxSpend420:String(input.maxSpend420),deadline});
}
export function submissionGate({config,wallet,draft}){
 if(!draft)return {allowed:false,reason:'Review the request first'};
 if(!wallet?.account)return {allowed:false,reason:'Connect a wallet'};
 if(config.features.writes!==true)return {allowed:false,reason:'Wallet transaction adapter not yet qualified'};
 return {allowed:true,reason:null};
}
