function bi(v){try{return BigInt(String(v??'0'));}catch{return 0n;}}
export function summarizeComputeDashboard420({jobs=[],rewards=[],projects=[],worker=null,reputation=[],stake=[],cpuMetricId=null,gpuMetricId=null}={}){
 let earnings=0n,cpu=0n,gpu=0n,completed=0;
 for(const j of jobs)if(['SETTLED','VERIFIED'].includes(j.status))completed++;
 for(const r of rewards){earnings+=bi(r.amount);if(cpuMetricId&&r.metricId?.toLowerCase()===cpuMetricId)cpu+=bi(r.contributionAmount);if(gpuMetricId&&r.metricId?.toLowerCase()===gpuMetricId)gpu+=bi(r.contributionAmount);}
 return Object.freeze({jobsCompleted:completed,earnings420:earnings.toString(),cpuContribution:cpu.toString(),gpuContribution:gpu.toString(),projectsSupported:projects.filter(p=>!p.retired).length,workerHealth:worker?{registered:true,revision:worker.revision,workerId:worker.workerId,operator:worker.operator,authoritative:false}:{registered:false,authoritative:false},latestReputation:reputation[0]??null,latestStakeReference:stake[0]??null,authoritative:false});
}
export function resultVerificationStatus420(job){if(!job)return null;return Object.freeze({jobId:job.jobId,status:job.status,resultCommitment:job.resultCommitment??null,verifier:job.verifier??null,verificationRef:job.verificationRef??null,approved:job.approved??null,authoritative:false});}
