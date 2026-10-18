import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTestnetDeployment,captureTestnetHandoffEvidence} from '../src/testnet-deployment-handoff.mjs';
const template=JSON.parse(readFileSync(new URL('../deployment/testnet-manifest.template.json',import.meta.url),'utf8'));
const obj=()=>({...structuredClone(template),releaseSha:'1234567890abcdef1234567890abcdef12345678',image:'registry.example.org/liftd@sha256:'+'0123456789abcdef'.repeat(4),configDigest:'9876543210fedcba'.repeat(4),observability:{...template.observability,policyDigest:'abcdef0123456789'.repeat(4)}});
test('template remains nonproduction, fully disabled, with digest-pinned image and named managed secrets',()=>{
 assert.throws(()=>validateTestnetDeployment(template),{code:'TESTNET_PLACEHOLDER_UNSAFE'});
 assert.equal(validateTestnetDeployment(template,{allowTemplate:true}).deployable,false);
 const p=validateTestnetDeployment(obj());
 assert.equal(p.deployable,true);
 assert.equal(p.trafficEnabled,false);
 assert.equal(p.secretRefCount,7);
});
test('deny forged service, privilege, live routing, floating container, and missing trust',()=>{
 const changes=[
 {publicIngress:true},{passengerTrafficEnabled:true},{dispatchEnabled:true},{paymentsEnabled:true},
 {publicRoutesEnabled:true},{hostNetwork:true},{readOnlyRootFilesystem:false},
 {runAsNonRoot:false},{allowPrivilegeEscalation:true},{automountServiceAccountToken:true},
 {replicas:2},{image:'registry.invalid/liftd:latest'},
 {secretRefs:{...template.secretRefs,identityTrust:'/tmp/identity'}},
 {secretRefs:{...template.secretRefs,identityTrust:template.secretRefs.registryTrust}},
 {health:{...template.health,visibility:'public'}},
 {health:{...template.health,readiness:'/health'}},
 {observability:{...template.observability,redaction:'none'}},
 {observability:{...template.observability,privateOnly:false}}
 ];
 for(const change of changes)assert.throws(()=>validateTestnetDeployment({...obj(),...change}),{code:'TESTNET_MANIFEST_DENIED'});
});
test('environment credentials and release cannot be smuggled in through config',()=>{
 assert.throws(()=>validateTestnetDeployment(obj(),{runtimeConfig:{environment:'testnet',releaseSha:template.releaseSha}}));
});
test('redacted evidence reports unready and denied acceptance without sensitive payloads',()=>{
 const evidence=captureTestnetHandoffEvidence({manifest:obj(),readiness:{ready:false},observation:{state:'unready',at:100,errorCode:'PROVIDER_UNAVAILABLE'},now:120});
 assert.equal(evidence.ready,false);assert.equal(evidence.independentAcceptance,'NOT_ACCEPTED');
 assert.ok(/^[a-f0-9]{64}$/.test(evidence.evidenceDigest));
 assert.doesNotMatch(JSON.stringify(evidence),/password|bearer|databaseUrl/);
 for(const payload of [
 {readiness:{ready:true,releaseSha:'f'.repeat(40)},observation:{state:'healthy',at:100}},
 {readiness:{ready:false},observation:{state:'unready',at:100,secret:'oops'}},
 {readiness:{ready:false},observation:{state:'unready',at:121}},
 {readiness:{ready:false},observation:{state:'unknown',at:100}},
 ])assert.throws(()=>captureTestnetHandoffEvidence({manifest:obj(),now:120,...payload}),{code:'TESTNET_EVIDENCE_INVALID'});
});
