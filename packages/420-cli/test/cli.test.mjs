import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const repoRoot=resolve(import.meta.dirname,'../../..'); const cli=resolve(repoRoot,'packages/420-cli/bin/420.mjs');
function run(args,cwd=repoRoot){return spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});} function json(cp){assert.equal(cp.status,0,cp.stderr); return JSON.parse(cp.stdout);}
test('version reports the CLI package identity',()=>{assert.equal(json(run(['version'])).name,'@420/cli');});
test('network consumes canonical DEVHUB network discovery',()=>{const output=json(run(['network'])); assert.equal(output.environment,'local'); assert.equal(output.chainId,'420');});
test('contract lookup consumes the canonical contract catalogue',()=>{assert.equal(json(run(['contract','ProtocolRegistry'])).verified,true);});
test('unknown contracts fail closed',()=>{assert.equal(run(['contract','DoesNotExist420']).status,3);});
test('wallet metadata fails closed when canonical wallet contracts are absent',()=>{assert.equal(run(['wallet-contracts']).status,3);});
test('devnet plan delegates to DEVHUB-5',()=>{assert.equal(json(run(['devnet','plan','30'])).profile,'real15');});
test('templates lists DEVHUB-7 starters',()=>{assert.deepEqual(json(run(['templates'])).templates.map(x=>x.id),['sdk-basic','wallet-aware','protocol-reader']);});
test('create delegates to DEVHUB-7 scaffolder',async()=>{const dir=await mkdtemp(resolve(tmpdir(),'cli420-create-')); try{const cp=run(['create','sdk-basic','demo'],dir); assert.equal(cp.status,0,cp.stderr);} finally{await rm(dir,{recursive:true,force:true});}});
test('test-account creates an external-custody descriptor without secret material',()=>{const output=json(run(['test-account','0x1111111111111111111111111111111111111111','ci'])); assert.equal(output.label,'ci'); assert.equal(output.custody,'external-wallet'); assert.equal(output.secretMaterialManaged,false);});
test('faucet request fails closed on the default local manifest',()=>{const cp=run(['faucet','request','0x1111111111111111111111111111111111111111']); assert.notEqual(cp.status,0); assert.match(cp.stderr,/testnet-only/);});
test('CLI exposes no private-key or mnemonic command surface',()=>{const cp=run(['help']); assert.equal(cp.status,0); assert.doesNotMatch(cp.stdout,/private[- ]?key|mnemonic|seed phrase/i); assert.match(cp.stdout,/420 create TEMPLATE NAME/); assert.match(cp.stdout,/420 faucet request ADDRESS/);});
