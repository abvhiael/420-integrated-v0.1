import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const root=resolve(here,'..');

test('dashboard exposes qualification view report and handoff as GET-only routes',async()=>{
  const server=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');
  for(const route of ['/api/qualification/view','/api/qualification/report','/api/qualification/handoff'])assert.match(server,new RegExp(route.replaceAll('/','\\/')));
  assert.match(server,/req\.method !== 'GET'/);
});

test('dashboard qualification surface does not expose mutation or secret routes',async()=>{
  const server=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');
  assert.doesNotMatch(server,/\/api\/qualification\/(upload|submit|sign|issue|rotate|revoke|secret|token)/i);
  assert.doesNotMatch(server,/eth_sendRawTransaction|eth_sendTransaction|personal_/);
});

test('browser labels qualification as non-authoritative release evidence',async()=>{
  const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');
  const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');
  assert.match(html,/developer-release gate only/i);
  assert.match(html,/does not certify security/i);
  assert.match(app,/requiresExactCommitBinding/);
  assert.match(app,/\/api\/qualification\/handoff/);
});
