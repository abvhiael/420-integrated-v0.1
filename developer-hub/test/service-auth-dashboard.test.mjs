import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
test('dashboard exposes read-only redacted service-auth routes only',async()=>{const source=await readFile(resolve(root,'dashboard/server.mjs'),'utf8');assert.match(source,/\/api\/service-auth\/view/);assert.match(source,/\/api\/service-auth\/credential/);assert.match(source,/req\.method !== 'GET'/);assert.doesNotMatch(source,/\/api\/service-auth\/(?:secret|rotate|revoke|issue)/);assert.match(source,/createServiceIdentityView420/);assert.match(source,/createCredentialLifecycleView420/);});
test('browser UI never references bearer secret or secret digest value fields',async()=>{const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');assert.match(html,/off-chain service authentication/);assert.match(html,/never returns bearer secrets/);assert.doesNotMatch(app,/secretSha256|apiKey|authorization\s*:/i);assert.match(app,/secretDigestPresent/);assert.match(app,/bearer secret exposed: no/);});
test('dashboard service-auth has no mutation controls',async()=>{const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8');const app=await readFile(resolve(root,'dashboard/static/app.js'),'utf8');assert.doesNotMatch(html,/rotate credential|revoke credential|issue credential/i);assert.doesNotMatch(app,/service-auth\/(?:rotate|revoke|issue)/);});
