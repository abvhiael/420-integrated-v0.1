import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createQuoteHttpServer} from '../../quote-service/src/http.js';
import {createOrderHttpServer} from '../../order-service/src/http.js';
import {createOrderPublicationStore} from '../../order-service/src/order-store.js';
import {createExchangeReadHttpServer} from '../../read-service/src/http.mjs';

const repo=path.resolve(import.meta.dirname,'../../..');
const addr=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');

async function cycle(server,probe){
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;await probe(base);
  server.close();await once(server,'close');
}

test('quote/order/read HTTP processes can stop and restart cleanly',async()=>{
  const quoteFactory=()=>createQuoteHttpServer({quoteEngine:async()=>({quoteId:'q'}),allowedOrigins:[]});
  await cycle(quoteFactory(),async base=>assert.equal((await fetch(base+'/wrong',{method:'POST',body:'{}'})).status,404));
  await cycle(quoteFactory(),async base=>assert.equal((await fetch(base+'/wrong',{method:'POST',body:'{}'})).status,404));

  const orderFactory=()=>{
    const store=createOrderPublicationStore({chainId:'0x420',settlementContract:addr(9),signatureVerifier:async()=>addr(1),withdrawalAuthorizer:async()=>true,clock:()=>1000});
    return createOrderHttpServer({store});
  };
  await cycle(orderFactory(),async base=>assert.equal((await fetch(base+'/missing')).status,404));
  await cycle(orderFactory(),async base=>assert.equal((await fetch(base+'/missing')).status,404));

  const svc={health:()=>({status:'ok'}),readiness:async()=>({ready:false}),snapshot:async()=>{throw new Error('down')},history:async()=>{throw new Error('down')}};
  await cycle(createExchangeReadHttpServer(svc),async base=>assert.equal((await fetch(base+'/ready')).status,503));
  await cycle(createExchangeReadHttpServer(svc),async base=>assert.equal((await fetch(base+'/v13/history?kind=TRADE')).status,503));
});

test('backend components fail closed without required live deployment dependencies',async()=>{
  const {createQuoteEngine}=await import('../../quote-service/src/quote-engine.js');
  assert.throws(()=>createQuoteEngine({}),/required|invalid/i);
  assert.throws(()=>createOrderPublicationStore({}),/required/i);
  const {loadExchangeReadConfig}=await import('../../read-service/src/startup.mjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pre11-missing-')),file=path.join(dir,'bad.json');
  fs.writeFileSync(file,JSON.stringify({schema:'420-exchange-read-service-config-v1'}));
  assert.throws(()=>loadExchangeReadConfig(file),/required/i);
});

test('PRE-11 packaging manifest is deterministic for an exact source SHA',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'exchange-package-'));
  const a=path.join(dir,'a.json'),b=path.join(dir,'b.json');
  for(const out of [a,b]){
    const r=spawnSync(process.execPath,['exchange/scripts/package-pretestnet.mjs',out],{cwd:repo,env:{...process.env,EXCHANGE_BUILD_SHA:'pre11-fixed-sha'},encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
  }
  assert.equal(fs.readFileSync(a,'utf8'),fs.readFileSync(b,'utf8'));
  const manifest=JSON.parse(fs.readFileSync(a,'utf8'));
  assert.equal(manifest.sourceSha,'pre11-fixed-sha');assert.ok(manifest.files.length>20);
  assert.ok(manifest.files.every(f=>/^[0-9a-f]{64}$/.test(f.sha256)&&f.bytes>=0));
});

test('all machine-readable live gates remain unresolved and hard OFF',()=>{
  const runtime=JSON.parse(fs.readFileSync(path.join(repo,'exchange/web/runtime-config.json'),'utf8'));
  const readiness=JSON.parse(fs.readFileSync(path.join(repo,'exchange/pretestnet-readiness.json'),'utf8'));
  for(const gate of readiness.liveGates){
    assert.equal(gate.resolved,false);
    assert.equal(gate.requiredState,'DISABLED_PRETESTNET');
    assert.equal(runtime.execution[gate.id],'DISABLED_PRETESTNET');
  }
});
