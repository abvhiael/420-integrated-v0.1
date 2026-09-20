import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeploymentCandidate,evaluateLaunchReadiness,REQUIRED_JOURNEYS,REQUIRED_RELEASE_EVIDENCE} from '../core/deployment-readiness.js';
const candidate={environment:'staging',appOrigin:'https://staging.bonggoggles.420integrated.org',chainId:420420,rpcUrl:'https://rpc.420integrated.org',indexerUrl:'https://indexer.420integrated.org',mediaUrl:'https://media.420integrated.org',messengerUrl:'https://messenger.420integrated.org',notificationsUrl:'https://notifications.420integrated.org',walletUrl:'https://wallet.420integrated.org',explorerUrl:'https://explorer.420integrated.org',maintenance:true,features:{}};
test('BG-19.15 requires explicit matching target and concrete non-example services',()=>{
 assert.equal(validateDeploymentCandidate(candidate,{expectedEnvironment:'staging'}).environment,'staging');
 assert.throws(()=>validateDeploymentCandidate(candidate),/explicit deployment environment/);
 assert.throws(()=>validateDeploymentCandidate(candidate,{expectedEnvironment:'production'}),/environment mismatch/);
 assert.throws(()=>validateDeploymentCandidate({...candidate,mediaUrl:'https://media.example'},{expectedEnvironment:'staging'}),/placeholder or local/);
 assert.throws(()=>validateDeploymentCandidate({...candidate,mediaUrl:'http:\/\/localhost:8080'},{expectedEnvironment:'staging'}),/placeholder or local|https/);
 assert.throws(()=>validateDeploymentCandidate({...candidate,walletUrl:'https://user:pass@wallet.420integrated.org'},{expectedEnvironment:'staging'}),/credentials/);
 assert.throws(()=>validateDeploymentCandidate({...candidate,rpcUrl:'https://rpc.420integrated.org/?token=secret'},{expectedEnvironment:'staging'}),/query or fragment/);
});
test('BG-19.15 production candidate stays in maintenance until release approval',()=>{
 const production={...candidate,environment:'production',appOrigin:'https://bonggoggles.420integrated.org'};
 assert.throws(()=>validateDeploymentCandidate({...production,maintenance:false},{expectedEnvironment:'production'}),/maintenance/);
 assert.equal(validateDeploymentCandidate(production,{expectedEnvironment:'production'}).maintenance,true);
});
test('BG-19.15 launch gate reports all missing journeys and independent deployment evidence',()=>{
 const report=evaluateLaunchReadiness();
 assert.equal(report.ready,false);
 assert.deepEqual(report.missingJourneys,REQUIRED_JOURNEYS);
 assert.deepEqual(report.missingEvidence,REQUIRED_RELEASE_EVIDENCE);
 const journeys=Object.fromEntries(REQUIRED_JOURNEYS.map(key=>[key,{result:'passed',url:'https://ci.420integrated.org/evidence/'+key}]));
 const evidence=Object.fromEntries(REQUIRED_RELEASE_EVIDENCE.map(key=>[key,{result:'passed',url:'https://ci.420integrated.org/evidence/'+key}]));
 assert.equal(evaluateLaunchReadiness({journeys,evidence}).ready,true);
 assert.equal(evaluateLaunchReadiness({journeys:{...journeys,'private-messaging':{result:'passed'}},evidence}).ready,false);
 assert.equal(evaluateLaunchReadiness({journeys,evidence:{...evidence,rollbackDrill:{result:'pending',url:'https://example.org'}}}).ready,false);
});
