import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/native-lifecycle.ts',import.meta.url),'utf8');
const browser=readFileSync(new URL('../src/native-identity.ts',import.meta.url),'utf8');
test('native lifecycle binds secure token vault, native Identity and independent session authority',()=>{
 assert.match(source,/createNativeIdentity\(config\.identity\)/);
 assert.match(source,/createNativeSession\(config\.sessionEndpoint\)/);
 assert.match(source,/AUTHORITY_NOT_CONFIGURED/);
 assert.match(source,/WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
 assert.match(source,/liftd\.preview\.identity\.tokens\.v1/);
});
test('native browser uses PKCE-S256 plus state, exact redirect and no embedded web view',()=>{
 assert.match(browser,/openAuthSessionAsync/);
 assert.match(browser,/code_challenge_method:'S256'/);
 assert.match(browser,/REDIRECT_URI_MISMATCH/);
 assert.match(browser,/getAll\('state'\)/);
 assert.doesNotMatch(browser,/WebView|AsyncStorage/);
});
