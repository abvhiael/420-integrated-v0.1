import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));const root=resolve(here,'..');
test('dashboard exposes launch readiness view check and closeout as GET-only routes',async()=>{const server=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');for(const route of ['/api/launch/view','/api/launch/check','/api/launch/closeout'])assert.match(server,new RegExp(route.replaceAll('/','\\/')));assert.match(server,/req\.method !== 'GET'/);});
test('launch dashboard has no deploy activate sign or mutation API',async()=>{const server=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');assert.doesNotMatch(server,/\/api\/launch\/(deploy|activate|publish|sign|submit|approve|execute|broadcast|secret|token)/i);assert.doesNotMatch(server,/eth_sendRawTransaction|eth_sendTransaction|personal_/);});
test('browser labels launch readiness as non-authoritative evidence',async()=>{const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');assert.match(html,/evidence-driven and non-authoritative/i);assert.match(html,/does not deploy/i);assert.match(app,/requiresExactCandidateBinding/);assert.match(app,/requiresExactReleaseChannel/);assert.match(app,/\/api\/launch\/closeout/);});
