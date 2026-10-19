import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/native-session.ts',import.meta.url),'utf8');
test('session persistence uses native hardware-backed secure storage API, no AsyncStorage',()=>{
 assert.match(src,/expo-secure-store/);assert.match(src,/WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
 assert.doesNotMatch(src,/AsyncStorage|localStorage|console\.log/);
});
test('native authority requires explicit secure configuration and bounded network read',()=>{
 assert.match(src,/AUTHORITY_NOT_CONFIGURED/);assert.match(src,/url\.protocol!=='https:'/);
 assert.match(src,/redirect:'error'/);assert.match(src,/body\.length>4096/);assert.match(src,/AbortController/);
});
