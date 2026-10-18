import {createHash} from 'node:crypto';
import {validateDeploymentConfig} from './deployment-security.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code})};
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const ref=x=>typeof x==='string'&&/^\/run\/secrets\/[a-z][a-z0-9_-]{2,80}$/.test(x);
const keys=['runtimeConfig','identityTrust','registryTrust','transportTrust','dbCa','auditSink','telemetrySink'];
const image=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9._:/-]{0,180}@sha256:[a-f0-9]{64}$/.test(x);
const allowed=['liftd-internal-health','liftd-internal-recovery'];
const canonical=x=>JSON.stringify(x,Object.keys(x).sort());
/** No credentials, public traffic, privilege elevation, or floating image tags. */
export function validateTestnetDeployment(manifest,{runtimeConfig}={}){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||manifest.version!==1||
 manifest.environment!=='testnet'||!sha(manifest.releaseSha)||!image(manifest.image)||
 !digest(manifest.configDigest)||manifest.namespace!=='liftd-isolated-testnet'||
 manifest.replicas!==1||manifest.runAsNonRoot!==true||manifest.readOnlyRootFilesystem!==true||
 manifest.allowPrivilegeEscalation!==false||manifest.automountServiceAccountToken!==false||
 manifest.hostNetwork!==false||manifest.publicIngress!==false||manifest.publicRoutesEnabled!==false||
 manifest.passengerTrafficEnabled!==false||manifest.dispatchEnabled!==false||manifest.paymentsEnabled!==false||
 !manifest.secretRefs||Object.keys(manifest.secretRefs).sort().join(',')!==keys.slice().sort().join(',')||
 keys.some(k=>!ref(manifest.secretRefs[k]))||
 new Set(keys.map(k=>manifest.secretRefs[k])).size!==keys.length||
 !manifest.health||manifest.health.liveness!=='/internal/live'||manifest.health.readiness!=='/internal/ready'||
 manifest.health.visibility!=='loopback'||manifest.health.port!==8080||
 !manifest.observability||manifest.observability.enabled!==true||manifest.observability.redaction!=='strict'||
 manifest.observability.privateOnly!==true||!digest(manifest.observability.policyDigest))
 fail('TESTNET_MANIFEST_DENIED');
 if(runtimeConfig!==undefined){
  const attestation=validateDeploymentConfig(runtimeConfig);
  if(attestation.environment!=='testnet'||attestation.releaseSha!==manifest.releaseSha||
     attestation.configDigest!==manifest.configDigest)fail('TESTNET_CONFIG_MISMATCH');
 }
 const projection={version:1,environment:manifest.environment,releaseSha:manifest.releaseSha,image:manifest.image,
  configDigest:manifest.configDigest,namespace:manifest.namespace,secretRefCount:keys.length,
  observabilityPolicyDigest:manifest.observability.policyDigest,trafficEnabled:false};
 return Object.freeze({...projection,manifestDigest:createHash('sha256').update(canonical(projection)).digest('hex')});
}
const severity=new Set(['healthy','unready','unavailable']);
/** Redacted operational evidence, not an independent provider attestation. */
export function captureTestnetHandoffEvidence({manifest,readiness,observation,now}){
 const validated=validateTestnetDeployment(manifest);
 if(!Number.isSafeInteger(now)||now<0||!readiness||typeof readiness!=='object'||
 !observation||typeof observation!=='object'||!severity.has(observation.state)||
 !Number.isSafeInteger(observation.at)||observation.at>now||
 Object.keys(observation).some(k=>!['state','at','errorCode'].includes(k))||
 (observation.errorCode!==undefined&&!/^[A-Z_]{3,64}$/.test(observation.errorCode))||
 Object.keys(readiness).some(k=>!['ready','releaseSha'].includes(k))||
 (readiness.ready!==true&&readiness.ready!==false)||
 (readiness.ready===true&&readiness.releaseSha!==manifest.releaseSha))
 fail('TESTNET_EVIDENCE_INVALID');
 const evidence={manifestDigest:validated.manifestDigest,releaseSha:manifest.releaseSha,
  observation:{...observation},ready:readiness.ready===true,trafficEnabled:false,
  independentAcceptance:'NOT_ACCEPTED',capturedAt:now};
 return Object.freeze({...evidence,evidenceDigest:createHash('sha256').update(JSON.stringify(evidence)).digest('hex')});
}
