import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');const bin=resolve(repoRoot,'packages/420-cli/bin/420-qualify.mjs');
function run(args){return spawnSync(process.execPath,[bin,...args],{cwd:repoRoot,encoding:'utf8'});}
test('qualification view exposes release-gate non-authority semantics',()=>{const result=run(['view']);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.canonicalAuthority,false);assert.equal(body.securityCertification,false);assert.ok(body.requiredChecks.includes('secret-material'));});
test('example qualification evidence passes for local network',()=>{const result=run(['check','developer-hub/qualification/evidence.example.json']);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.result,'PASS');assert.equal(body.qualifiedForDeveloperRelease,true);});
test('blocked qualification returns nonzero gate status',()=>{const result=run(['check','developer-hub/qualification/evidence.example.json','developer-hub/manifests/local.example.json']);assert.equal(result.status,0,result.stderr);});
