import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('native integration assembly uses official Travel SDK and approved origin',()=>{
 const source=readFileSync(new URL('../src/native-integrations.ts',import.meta.url),'utf8');
 assert.match(source,/createLiftdTravelSdk/);assert.match(source,/createMobileServiceApi/);assert.match(source,/getRandomBytes\(24\)/);
});
test('rider and driver include bounded integrated trip services without enabling preview payments',()=>{
 for(const p of ['RiderScreen.tsx','DriverScreen.tsx']){
  const src=readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
  assert.match(src,/TripIntegrations trip=\{snapshot\?\.trip\}/);
 }
 const integrated=readFileSync(new URL('../src/TripIntegrations.tsx',import.meta.url),'utf8');
 assert.match(integrated,/NONPRODUCTION/);assert.match(integrated,/accessibilityState=\{\{disabled:!enabled\}\}/);
 assert.doesNotMatch(integrated,/privateKey|seedPhrase|autoSign/);
});
