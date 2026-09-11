import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');const bin=resolve(repoRoot,'packages/420-cli/bin/420-launch.mjs');
function run(args){return spawnSync(process.execPath,[bin,...args],{cwd:repoRoot,encoding:'utf8'});}
function fixture(releaseReady){const dir=mkdtempSync(join(tmpdir(),'420-launch-'));const q=join(dir,'qualification.json');const h=join(dir,'handoff.json');const r=join(dir,'readiness.json');writeFileSync(q,JSON.stringify({result:'PASS',qualifiedForDeveloperRelease:true,canonicalAuthority:false,securityCertification:false}));writeFileSync(h,JSON.stringify({releaseEvidenceReady:true,commitSha:'1111111111111111111111111111111111111111',canonicalAuthority:false}));writeFileSync(r,JSON.stringify({public_testnet_ready:releaseReady,checks:[{name:'production soak',status:releaseReady?'PASS':'BLOCKED',detail:releaseReady?'qualified':'pending'}]}));return {dir,q,h,r};}
test('launch view exposes evidence-driven non-authority semantics',()=>{const result=run(['view']);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.canonicalAuthority,false);assert.equal(body.securityCertification,false);assert.ok(body.requiredInputs.includes('release/readiness.json'));});
test('blocked release evidence returns gate exit code 3',()=>{const f=fixture(false);try{const result=run(['check',f.q,f.h,f.r]);assert.equal(result.status,3,result.stderr);assert.equal(JSON.parse(result.stdout).result,'BLOCKED');}finally{rmSync(f.dir,{recursive:true,force:true});}});
test('explicit ready evidence returns READY',()=>{const f=fixture(true);try{const result=run(['check',f.q,f.h,f.r]);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.result,'READY');assert.equal(body.readyForProductionLaunch,true);}finally{rmSync(f.dir,{recursive:true,force:true});}});
