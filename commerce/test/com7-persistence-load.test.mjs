import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { Database } from '../src/database.mjs';
import { Projection } from '../src/projection.mjs';
import { RequestAuth, signingMessage, hash } from '../src/security.mjs';
import { commerceServer } from '../src/http.mjs';
import { setup, listingEvent, batch, header, buyer, b32 } from './fixtures.mjs';

test('COM-7 persisted nonce consumption is exclusive across connections and survives reopen', async t => {
  const f=setup(); t.after(()=>f.close());
  const other=new Database(f.file); t.after(()=>other.close());
  const options={origin:'http://127.0.0.1',chainId:'420',now:f.now};
  const first=new RequestAuth(f.db,options),second=new RequestAuth(other,options);
  const challenge=first.challenge(buyer.address),body=Buffer.from('{}'),path='/v1/carts';
  const signature=await buyer.signMessage(signingMessage({...challenge,origin:options.origin,chainId:'420',method:'POST',path,bodyHash:hash(body)}));
  const headers={'x-commerce-wallet':buyer.address,'x-commerce-nonce':challenge.nonce,'x-commerce-signature':signature};
  assert.equal(second.authenticate(headers,'POST',path,body,options.origin),buyer.address.toLowerCase());
  assert.throws(()=>first.authenticate(headers,'POST',path,body,options.origin),e=>e.code==='invalid_nonce');
  const reopened=new Database(f.file);
  try { assert.throws(()=>new RequestAuth(reopened,options).authenticate(headers,'POST',path,body,options.origin),e=>e.code==='invalid_nonce'); }
  finally { reopened.close(); }
});

test('COM-7 persistent replay and failed transaction recovery retain checkpoint and outbox', async t => {
  const f=setup(); t.after(()=>f.close());
  const event=listingEvent(f); await f.projection.ingest(batch([event]),[header()]);
  const other=new Database(f.file); t.after(()=>other.close());
  const p=new Projection(other,f.authority,{chainId:'420',contracts:f.contracts,startHeight:1,startParentHash:b32(99),now:f.now});
  await p.ingest(batch([event]),[header()]);
  for(const table of ['event_inbox','catalogue_projection','projection_outbox']) assert.equal(other.get(`SELECT COUNT(*) AS n FROM ${table}`).n,1);
  assert.throws(()=>other.transaction(()=>{other.run('DELETE FROM event_inbox');throw new Error('interrupted');}),/interrupted/);
  const child=spawnSync(process.execPath,['--input-type=module','-e',
    `import {Database} from ${JSON.stringify(new URL('../src/database.mjs',import.meta.url).href)};
     const db=new Database(process.argv[1]);
     db.db.exec('BEGIN IMMEDIATE');db.run('DELETE FROM event_inbox');process.exit(23);`,f.file],{timeout:10000});
  assert.equal(child.status,23,child.stderr?.toString());
  const reopened=new Database(f.file);
  try {
    assert.equal(reopened.get('SELECT COUNT(*) AS n FROM event_inbox').n,1);
    assert.equal(reopened.get('SELECT cursor FROM projection_checkpoints').cursor,'opaque-cursor');
    assert.equal(reopened.get('SELECT delivered_at FROM projection_outbox').delivered_at,null);
  } finally { reopened.close(); }
});

test('COM-7 bounded HTTP load preserves health, enforces rate cap and recovers next window', async t => {
  const f=setup(); t.after(()=>f.close());
  const server=commerceServer(f.service,null,{origin:'http://127.0.0.1',now:f.now,rateLimit:120});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}/v1/health`,latencies=[],statuses=[];
  const started=performance.now();
  for(let wave=0;wave<16;wave++) await Promise.all(Array.from({length:16},async()=>{
    const start=performance.now(),response=await fetch(url,{signal:AbortSignal.timeout(5000)});
    const value=await response.json();latencies.push(performance.now()-start);statuses.push(response.status);
    assert.equal(value.schema,'420-commerce-api-v1');
    if(response.status===429) assert.equal(value.error.code,'rate_limit'); else assert.equal(response.status,200);
  }));
  const elapsed=performance.now()-started,p95=latencies.sort((a,b)=>a-b)[Math.ceil(latencies.length*.95)-1];
  assert.equal(statuses.filter(x=>x===200).length,120);
  assert.equal(statuses.filter(x=>x===429).length,136);
  assert.ok(elapsed<15000,`elapsed ${elapsed}ms exceeds local 15s budget`);
  assert.ok(p95<2000,`p95 ${p95}ms exceeds local 2s budget`);
  f.advance(60000); assert.equal((await fetch(url)).status,200);
  assert.equal(f.db.get('SELECT COUNT(*) AS n FROM checkout_attempts').n,0);
  t.diagnostic(JSON.stringify({requests:256,concurrency:16,elapsedMs:elapsed,p95Ms:p95,accepted:120,limited:136,scope:'local HTTP and persistent SQLite; no production capacity claim'}));
});
