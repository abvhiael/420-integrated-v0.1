import {createComputeReadApi420} from './read-api.js';import {createComputeJobClient420} from './job-api.js';import {summarizeComputeDashboard420,resultVerificationStatus420} from './dashboard.js';
export function createComputeController420(config,{fetchImpl=fetch}={}){const read=createComputeReadApi420(config,fetchImpl),jobs=createComputeJobClient420(config,fetchImpl);return Object.freeze({
 submitJob:(envelope)=>jobs.submit(envelope),
 async dashboard({account,workerId}){const [jobPage,rewardPage,projectPage,worker,reputation,stake,status]=await Promise.all([read.jobs(account),read.rewards(account),read.projects(account),workerId?read.worker(workerId):Promise.resolve(null),workerId?read.reputation(workerId):Promise.resolve({items:[]}),workerId?read.stake(workerId):Promise.resolve({items:[]}),read.status()]);return{summary:summarizeComputeDashboard420({jobs:jobPage.items,rewards:rewardPage.items,projects:projectPage.items,worker,reputation:reputation.items,stake:stake.items,cpuMetricId:config.cpuMetricId,gpuMetricId:config.gpuMetricId}),status,jobs:jobPage,projects:projectPage,rewards:rewardPage,reputation,stake};},
 async workerOperations(account){return read.workers(account);},
 async verifierOperations(account){return read.verifiers(account);},
 async projectManagement(account){return read.projects(account);},\n availableProjects:(limit=50)=>read.availableProjects(limit),
 async inspectJob(jobId){return resultVerificationStatus420(await read.job(jobId));}
});}
