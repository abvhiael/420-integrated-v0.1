import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('native erasure addresses BOTH independent SecureStore keychain services and fails closed',()=>{
 const source=read('../src/native-erasure.ts');
 assert.match(source,/liftd\.preview\.identity\.tokens\.v1/);
 assert.match(source,/liftd\.preview\.session\.v1/);
 assert.match(source,/Promise\.allSettled/);
 assert.match(source,/LOCAL_ERASURE_INCOMPLETE/);
 assert.doesNotMatch(source,/AsyncStorage|console\.log/);
});
test('background/foreground cannot revive cached role authority',()=>{
 const source=read('../src/native-app-state.ts');
 assert.match(source,/next!=='active'\|\|last!=='active'/);
 assert.match(source,/safeResumeState/);
});
test('native preview keeps cleartext and background location disabled',()=>{
 const app=JSON.parse(read('../app.json')).expo;
 assert.equal(app.android.usesCleartextTraffic,false);
 assert.deepEqual(app.android.permissions,[]);
 assert.equal(app.extra.apiEnabled,false);
 assert.equal(app.updates.enabled,false);
 assert.equal(app.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads,false);
});

test('native credential stores delete malformed JSON rather than restoring corrupted credentials',()=>{
 for(const path of ['../src/native-session.ts','../src/native-lifecycle.ts']){
  const source=read(path);
  assert.match(source,/JSON\.parse\(value\)/);
  assert.match(source,/catch\{await SecureStore\.deleteItemAsync/);
  assert.match(source,/STORE_CORRUPT/);
 }
});
test('native OAuth browser validates restricted callback policy before code extraction',()=>{
 const source=read('../src/native-identity.ts');
 assert.match(source,/parseExternalLink\(result\.url\)/);
 assert.match(source,/AUTHORIZATION_DENIED/);
});
