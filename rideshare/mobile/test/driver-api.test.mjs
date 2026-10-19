import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createDriverApi} from '../src/driver-api.mjs';
test('native driver assembly requires approved endpoint and cryptographic command IDs',()=>{
 const src=readFileSync(new URL('../src/native-driver.ts',import.meta.url),'utf8');assert.match(src,/createDriverJourney/);assert.match(src,/getRandomBytes\(24\)/);assert.match(src,/DRIVER_NOT_CONFIGURED/);
});
test('driver preview is role-separated with disabled service actions',()=>{
 const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');const screen=readFileSync(new URL('../src/DriverScreen.tsx',import.meta.url),'utf8');
 assert.match(app,/<DriverScreen\/>/);assert.match(screen,/NONPRODUCTION PREVIEW/);assert.match(screen,/accessibilityState=\{\{disabled:!enabled\}\}/);
});
test('origin and unauthorized tokens never reach backend',async()=>{
 for(const origin of ['http://example.com/','https://u:p@example.com/','https://example.com/path/'])assert.throws(()=>createDriverApi({origin,accessToken:async()=> 'a.b.c'}),/UNAPPROVED_ORIGIN/);
 let calls=0;const api=createDriverApi({origin:'https://example.com/',accessToken:async()=>null,fetchImpl:async()=>{calls++;}});
 await assert.rejects(api.readAvailability({subject:'driver1'}),/UNVERIFIED_SESSION/);assert.equal(calls,0);
});
test('authenticated driver requests preserve cache, redirect and credential restrictions',async()=>{
 const calls=[];const api=createDriverApi({origin:'https://example.com/',accessToken:async()=> 'aaa.bbb.ccc',fetchImpl:async(u,o)=>{calls.push({u,o});return {ok:true,headers:{get:()=> 'application/json'},text:async()=> '{}'};}});
 await api.readOnboarding({subject:'driver1'});assert.equal(calls[0].u,'https://example.com/v1/rideshare/drivers/driver1/onboarding');
 assert.equal(calls[0].o.credentials,'omit');assert.equal(calls[0].o.redirect,'error');assert.equal(calls[0].o.cache,'no-store');
});
