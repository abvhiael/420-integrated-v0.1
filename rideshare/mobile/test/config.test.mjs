import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('both mobile platforms are configured as preview-only with network updates disabled',()=>{
 const e=JSON.parse(read('../app.json')).expo;
 assert.match(e.ios.bundleIdentifier,/\.preview$/);
 assert.match(e.android.package,/\.preview$/);
 assert.equal(e.extra.apiEnabled,false);
 assert.equal(e.updates.enabled,false);
 assert.equal(e.android.usesCleartextTraffic,false);
 assert.deepEqual(e.android.permissions,[]);
});
test('public preview has no endpoint, wallet signer, token or fake user provisioning',()=>{
 const app=read('../App.tsx');
 assert.doesNotMatch(app,/(https?:\/\/|fetch\s*\(|WebSocket|privateKey|accessToken|paymentIntent)/);
 assert.match(app,/NONPRODUCTION PREVIEW/);
});
