import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const yaml=read('../deployment/kubernetes-testnet.disabled.yaml');
const entry=read('../scripts/start-admitted-runtime.mjs');
const probe=read('../scripts/probe-admitted-runtime.mjs');
test('PT-11 example cannot start pods, publish ingress, or obtain cluster tokens',()=>{
 for(const required of [
 'kind: Deployment','replicas: 0','image: registry.invalid/liftd@sha256:',
 'serviceAccountName: liftd-readonly','automountServiceAccountToken: false',
 'runAsNonRoot: true','readOnlyRootFilesystem: true',
 'allowPrivilegeEscalation: false','drop: ["ALL"]',
 'type: RuntimeDefault','hostNetwork: false',
 'driver: secrets-store.csi.k8s.io','mountPath: /run/secrets',
 'kind: NetworkPolicy','policyTypes: ["Ingress", "Egress"]',
 'ingress: []','egress: []',
 ])assert.ok(yaml.includes(required),required);
 assert.doesNotMatch(yaml,/kind:\s*Ingress|kind:\s*Service\s*$/m);
 assert.match(yaml,/livenessProbe:\n\s+exec:/);
 assert.match(yaml,/readinessProbe:\n\s+exec:/);
});
test('PT-11 entrypoint requires protected managed config and localhost only',()=>{
 for(const required of ["'/run/secrets/liftd-runtime-config'","(stat.mode&0o077)!==0","stat.size>16384","host:'127.0.0.1'"])assert.ok(entry.includes(required));
 assert.ok(probe.includes("'http://127.0.0.1:8080'"));
 assert.ok(probe.includes("AbortSignal.timeout(2500)"));
 assert.ok(probe.includes("response.status!==200"));
});
