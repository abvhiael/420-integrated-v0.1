function bi(v){try{return BigInt(String(v??'0'));}catch{return 0n;}}
export function summarizeComputeDashboard420({jobs=[],rewards=[],contributions=[],worker=null,reputation=[],stake=[],cpuMetricId=null,gpuMetricId=null}={}){
 let earnings=0n,cpu=0n,gpu=0n,completed=0;
 for(const j of jobs)if(['SETTLED','VERIFIED'].includes(j.status))completed++;
 for(const r of rewards)earnings+=bi(r.amount);
 const supported=new Set();
 for(const x of contributions){if(x.projectRef)supported.add(String(x.projectRef).toLowerCase());if(cpuMetricId&&x.metricId?.toLowerCase()===cpuMetricId)cpu+=bi(x.amount);if(gpuMetricId&&x.metricId?.toLowerCase()===gpuMetricId)gpu+=bi(x.amount);}
 return Object.freeze({jobsCompleted:completed,earnings420:earnings.toString(),cpuContribution:cpu.toString(),gpuContribution:gpu.toString(),projectsSupported:supported.size,workerHealth:worker?{registered:true,revision:worker.revision,workerId:worker.workerId,operator:worker.operator,authoritative:false}:{registered:false,authoritative:false},latestReputation:reputation[0]??null,latestStakeReference:stake[0]??null,authoritative:false});
}
export function resultVerificationStatus420(job){if(!job)return null;return Object.freeze({jobId:job.jobId,status:job.status,resultCommitment:job.resultCommitment??null,verifier:job.verifier??null,verificationRef:job.verificationRef??null,approved:job.approved??null,authoritative:false});}
