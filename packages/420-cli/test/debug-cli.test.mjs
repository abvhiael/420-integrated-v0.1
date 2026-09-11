import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot=resolve(import.meta.dirname,'../../..');
const cli=resolve(repoRoot,'packages/420-cli/bin/420.mjs');
function run(args){return spawnSync(process.execPath,[cli,...args],{cwd:repoRoot,encoding:'utf8'});}
function json(cp){assert.equal(cp.status,0,cp.stderr);return JSON.parse(cp.stdout);}

test('debug view exposes DEVHUB-15 provenance boundary without network calls',()=>{
  const output=json(run(['debug','view']));
  assert.equal(output.title,'Logs, events & debugging');
  assert.equal(output.chainId,'420');
  assert.equal(output.canonicalAuthority,false);
  assert.deepEqual(output.supported,['transaction-debug','logs','protocol-events','diagnostics']);
  assert.match(output.securityRule,/cannot replace canonical chain\/protocol authority/);
});

test('help exposes debugging commands without adding signing surfaces',()=>{
  const cp=run(['help']);
  assert.equal(cp.status,0,cp.stderr);
  assert.match(cp.stdout,/420 debug view/);
  assert.match(cp.stdout,/420 debug diagnostics/);
  assert.match(cp.stdout,/420 debug tx HASH/);
  assert.match(cp.stdout,/420 debug logs/);
  assert.match(cp.stdout,/420 debug events PROTOCOL/);
  assert.doesNotMatch(cp.stdout,/debug sign|debug send|debug mutate/i);
});
