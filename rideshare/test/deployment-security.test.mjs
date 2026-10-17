import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeploymentConfig,verifyReleaseAsset,assessReadiness} from '../src/deployment-security.mjs';
import {createHash} from 'node:crypto';
const digest=n=>String(n).repeat(64);
const good=()=>({environment:'testnet',publicOrigin:'https://rideshare.example.org/',databaseUrl:'postgres://liftd_runtime:private-secret@postgres.example.org/liftd?sslmode=verify-full',databaseRole:'liftd_runtime',tlsMode:'trusted-terminator',secretProvider:'managed',identityKeyDigest:digest('a'),sessionKeyDigest:digest('b'),locationKeyDigest:digest('c'),releaseSha:'d'.repeat(40),enableDispatch:false,enablePayments:false,enablePassengerTraffic:false,limits:{requestBytes:1024,timeoutMs:3000}});
test('deployment configuration fails closed on TLS, db superuser, key overlap, live enablement and SHA',()=>{
 assert.equal(validateDeploymentConfig(good()).trafficEnabled,false);
 for(const change of [
 {publicOrigin:'http://rideshare.example.org/'},{databaseRole:'postgres'},
 {databaseUrl:'postgres://postgres:secret@postgres.example.org/liftd?sslmode=verify-full'},
 {databaseUrl:'postgres://liftd_runtime:secret@postgres.example.org/liftd?sslmode=disable'},
 {secretProvider:'local'},{identityKeyDigest:digest('b')},{enablePayments:true},
 {releaseSha:'main'},{limits:{requestBytes:99999999,timeoutMs:3000}}
 ]) assert.throws(()=>validateDeploymentConfig({...good(),...change}));
});
test('sealed release artifact rejects tampering',()=>{const data=Buffer.from('image-release');const sha=createHash('sha256').update(data).digest('hex');assert.equal(verifyReleaseAsset(data,sha),true);assert.throws(()=>verifyReleaseAsset(Buffer.from('tampered'),sha));});
test('readiness rejects superuser and missing migrations',async()=>{
 const pool=rows=>({connect:async()=>({query:async sql=>{if(sql.includes('current_user AS role'))return {rows:[rows.role]};if(sql.includes('count(*)'))return {rows:[{count:rows.migrations}]};return {rows:[]}},release(){}})});
 const superuser=pool({role:{role:'postgres',rolsuper:true,rolcreatedb:true,rolcreaterole:true},migrations:15});
 await assert.rejects(()=>assessReadiness(superuser));
 const incomplete=pool({role:{role:'liftd_runtime',rolsuper:false,rolcreatedb:false,rolcreaterole:false},migrations:1});
 await assert.rejects(()=>assessReadiness(incomplete));
});
