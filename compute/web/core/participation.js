const HEX32=/^0x[0-9a-fA-F]{64}$/;
function bytes(v,n){if(typeof v!=='string'||!HEX32.test(v))throw new Error(n+' must be bytes32 hex');return v.toLowerCase();}
function pct(v,n,min=0){const x=Number(v);if(!Number.isFinite(x)||x<min||x>100||(n==='CPU'&&x===0))throw new Error(n+' percent out of bounds');return x;}
export function buildParticipationProfile420(config,input){
 const cpu=pct(input.cpuPercent,'CPU',0.01),gpu=pct(input.gpuPercent??0,'GPU',0);
 const projects=[...new Set((input.projectIds??[]).map((v,i)=>bytes(v,'projectIds['+i+']')))];
 const profile=Object.freeze({schemaVersion:'420-compute-participation-profile-v1',chainId:config.chainId,providerId:bytes(input.providerId,'providerId'),nodeId:bytes(input.nodeId,'nodeId'),resourceId:bytes(input.resourceId,'resourceId'),workerId:bytes(input.workerId,'workerId'),cpuPercent:cpu,gpuPercent:gpu,projectPreferences:Object.freeze(projects),projectPreferenceAuthority:'LOCAL_PREFERENCE_ONLY',canonicalAssignmentRequired:true});
 const args=['--chain-id',config.chainId,'--provider-id',profile.providerId,'--node-id',profile.nodeId,'--resource-id',profile.resourceId,'--worker-id',profile.workerId,'--state-dir','@STATE_DIR@','--cpu-percent',String(cpu),'--gpu-percent',String(gpu),'--max-workload-violations','3','--workload-quarantine','30m'];
 return Object.freeze({profile,workerArgs:args.join('\n')+'\n',downloads:config.workerDownloads});
}
export function participationSteps420(bundle){return Object.freeze([
 {id:'download',title:'Install the worker',detail:'Use the signed/checksummed platform package for your OS. Installation does not auto-start the worker.'},
 {id:'identity',title:'Use canonical identities',detail:'Copy provider, node, resource and worker identifiers from your registered Compute identity.'},
 {id:'limits',title:'Choose local limits',detail:`CPU ${bundle.profile.cpuPercent}% · GPU ${bundle.profile.gpuPercent}%`},
 {id:'projects',title:'Choose project preferences',detail:bundle.profile.projectPreferences.length?bundle.profile.projectPreferences.join(', '):'No local project preference selected. Canonical assignments still govern execution.'},
 {id:'configure',title:'Save worker.args',detail:'One exact argument per line. Never put private keys or seed phrases in this file.'},
 {id:'start',title:'Start explicitly',detail:'Enable/start the packaged worker only after reviewing configuration and canonical registration.'}
]);}
