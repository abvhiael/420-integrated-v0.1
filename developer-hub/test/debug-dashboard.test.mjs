import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');

test('dashboard server exposes only read-only DEVHUB-15 diagnostic routes',async()=>{
  const source=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');
  for(const route of ['/api/debug/view','/api/debug/diagnostics','/api/debug/transaction','/api/debug/logs','/api/debug/events']) assert.match(source,new RegExp(route.replaceAll('/','\\/')));
  assert.match(source,/req\.method !== 'GET'/);
  assert.doesNotMatch(source,/eth_sendRawTransaction|eth_sendTransaction|personal_/);
});

test('dashboard UI labels debugging as projection plus canonical RPC correlation',async()=>{
  const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');
  const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');
  assert.match(html,/logs, events & debugging/);
  assert.match(html,/indexed data never becomes protocol authority/);
  assert.match(app,/api\/debug\/transaction/);
  assert.match(app,/api\/debug\/logs/);
  assert.match(app,/api\/debug\/events/);
  assert.match(app,/api\/debug\/diagnostics/);
});
