import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const sha=x=>x.repeat(64);
const script=resolve('rideshare/scripts/rollback-qualification.sh');
test('failed candidate rolls back to pinned prior image, rechecks readiness and avoids schema down-migration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'liftd-rollback-'));
 try{
  const state=join(dir,'state'),calls=join(dir,'calls'),controller=join(dir,'controller'),ready=join(dir,'ready');
  writeFileSync(controller,'#!/bin/bash\nset -euo pipefail\necho "$*" >> "$LIFTD_CALLS"\nif [[ "$1" == deploy ]]; then printf "%s" "$2" > "$LIFTD_STATE"; fi\n');
  writeFileSync(ready,'#!/bin/bash\n[[ "$(cat "$LIFTD_STATE")" == "$LIFTD_ROLLBACK_PREVIOUS_IMAGE" ]]\n');
  const env={...process.env,LIFTD_ROLLBACK_DATABASE_URL:'postgres://localhost/liftd_qualification',LIFTD_ROLLBACK_PREVIOUS_IMAGE:'liftd@sha256:'+sha('a'),LIFTD_ROLLBACK_CANDIDATE_IMAGE:'liftd@sha256:'+sha('b'),LIFTD_ROLLBACK_CONFIG:'/run/secrets/liftd.json',LIFTD_ROLLBACK_CONTROLLER:controller,LIFTD_ROLLBACK_READINESS:ready,LIFTD_STATE:state,LIFTD_CALLS:calls};
  const x=spawnSync('bash',[script],{env,encoding:'utf8'});assert.equal(x.status,0,x.stderr);
  assert.match(x.stdout,/ROLLBACK_READY_PREVIOUS_IMAGE/);
  assert.deepEqual(readFileSync(calls,'utf8').trim().split('\n'),['stop','deploy '+env.LIFTD_ROLLBACK_CANDIDATE_IMAGE,'stop','deploy '+env.LIFTD_ROLLBACK_PREVIOUS_IMAGE]);
  assert.equal(readFileSync(state,'utf8'),env.LIFTD_ROLLBACK_PREVIOUS_IMAGE);
  const invalid=spawnSync('bash',[script],{env:{...env,LIFTD_ROLLBACK_CANDIDATE_IMAGE:'liftd:latest'},encoding:'utf8'});
  assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/ROLLBACK_IMAGE_DIGEST_REQUIRED/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('failed rollback leaves traffic stopped and never signals success',()=>{
 const dir=mkdtempSync(join(tmpdir(),'liftd-rollback-fail-'));
 try{
  const calls=join(dir,'calls'),controller=join(dir,'controller'),ready=join(dir,'ready');
  writeFileSync(controller,'#!/bin/bash\nset -euo pipefail\necho "$*" >> "$LIFTD_CALLS"\n');
  writeFileSync(ready,'#!/bin/bash\nexit 1\n');
  const env={...process.env,LIFTD_ROLLBACK_DATABASE_URL:'postgres://localhost/liftd_qualification',LIFTD_ROLLBACK_PREVIOUS_IMAGE:'liftd@sha256:'+sha('a'),LIFTD_ROLLBACK_CANDIDATE_IMAGE:'liftd@sha256:'+sha('b'),LIFTD_ROLLBACK_CONFIG:'/run/secrets/liftd.json',LIFTD_ROLLBACK_CONTROLLER:controller,LIFTD_ROLLBACK_READINESS:ready,LIFTD_CALLS:calls};
  const x=spawnSync('bash',[script],{env,encoding:'utf8'});
  assert.notEqual(x.status,0);assert.match(x.stderr,/ROLLBACK_UNREADY_TRAFFIC_DISABLED/);
  assert.equal(readFileSync(calls,'utf8').trim().split('\n').at(-1),'stop');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
