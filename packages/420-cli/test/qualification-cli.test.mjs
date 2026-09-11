import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');const bin=resolve(repoRoot,'packages/420-cli/bin/420-qualify.mjs');
function run(args){return spawnSync(process.execPath,[bin,...args],{cwd:repoRoot,encoding:'utf8'});}
test('qualification view exposes release-gate non-authority semantics',()=>{const result=run(['view']);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.canonicalAuthority,false);assert.equal(body.securityCertification,false);assert.ok(body.requiredChecks.includes('secret-material'));});
test('example qualification evidence passes for local network',()=>{const result=run(['check','developer-hub/qualification/evidence.example.json']);assert.equal(result.status,0,result.stderr);const body=JSON.parse(result.stdout);assert.equal(body.result,'PASS');assert.equal(body.qualifiedForDeveloperRelease,true);});
test('blocked qualification returns gate exit code 3',()=>{const dir=mkdtempSync(join(tmpdir(),'420-qualify-'));try{const source=JSON.parse(readFileSync(resolve(repoRoot,'developer-hub/qualification/evidence.example.json'),'utf8'));source.checks=source.checks.filter(check=>check.id!=='tests-qualified');const path=join(dir,'blocked.json');writeFileSync(path,JSON.stringify(source));const result=run(['check',path]);assert.equal(result.status,3,result.stderr);assert.equal(JSON.parse(result.stdout).result,'BLOCKED');}finally{rmSync(dir,{recursive:true,force:true});}});
