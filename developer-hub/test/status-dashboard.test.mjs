import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(process.cwd());
test('dashboard exposes read-only DEVHUB-17 status routes only',async()=>{const server=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');assert.match(server,/\/api\/status\/view/);assert.match(server,/\/api\/status\/check/);assert.match(server,/req\.method !== 'GET'/);assert.doesNotMatch(server,/\/api\/status\/(?:write|set|override|finalize|authorize)/);});
test('dashboard status UI states non-authority rule',async()=>{const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');assert.match(html,/green does not prove finality/);assert.match(app,/\/api\/status\/check/);assert.doesNotMatch(app,/canonicalAuthority\s*=\s*true/);});
