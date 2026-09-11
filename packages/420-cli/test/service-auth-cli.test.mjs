import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const repoRoot=resolve(import.meta.dirname,'../../..');const cli=resolve(repoRoot,'packages/420-cli/bin/420-auth.mjs');
function run(args){return spawnSync(process.execPath,[cli,...args],{cwd:repoRoot,encoding:'utf8'});}function json(cp){assert.equal(cp.status,0,cp.stderr);return JSON.parse(cp.stdout);}
test('420-auth identity exposes only off-chain authority',()=>{const v=json(run(['identity','developer-hub/service-auth/application.example.json']));assert.equal(v.canonicalProtocolAuthority,false);assert.equal(v.walletCapability,false);});
test('420-auth credential view redacts the secret digest value',()=>{const v=json(run(['credential','developer-hub/service-auth/credential.example.json','2026-09-11T15:00:00Z']));assert.equal(v.status,'ACTIVE');assert.equal(v.secretDigestPresent,true);assert.equal('secretSha256' in v,false);assert.equal(v.secretMaterialManaged,false);});
test('420-auth help exposes lifecycle planning and no secret output command',()=>{const cp=run(['help']);assert.equal(cp.status,0,cp.stderr);assert.match(cp.stdout,/420-auth rotate/);assert.match(cp.stdout,/420-auth revoke/);assert.doesNotMatch(cp.stdout,/show-secret|print-secret|export-secret/i);});
