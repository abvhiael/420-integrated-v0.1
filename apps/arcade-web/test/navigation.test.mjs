import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const base=fileURLToPath(new URL('../',import.meta.url));
test('canonical routes and unknown/malicious paths fail closed',async()=>{
 const vite=await createServer({root:base,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{
  const {resolveRoute}=await vite.ssrLoadModule('/src/App.tsx');
  for(const s of ['', '#/', '#/games'])assert.deepEqual(resolveRoute(s),{kind:'catalog'});
  assert.deepEqual(resolveRoute('#/about'),{kind:'about'});
  assert.deepEqual(resolveRoute('#/accessibility'),{kind:'accessibility'});
  assert.deepEqual(resolveRoute('#/games/kush-crush'),{kind:'game',slug:'kush-crush'});
  for(const s of ['#/games/../../admin','#/games/not-authorized','#/games/%2fadmin','#/games/kush-crush/extra','#/games/<script>','#/wallet','#/games/constructor'])assert.deepEqual(resolveRoute(s),{kind:'not-found'});
 }finally{await vite.close();}
});
test('responsive accessible shell preserves exactly eleven disabled games',async()=>{
 const vite=await createServer({root:base,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{
  const {Launcher}=await vite.ssrLoadModule('/src/App.tsx');
  const show=route=>renderToStaticMarkup(React.createElement(Launcher,{initialRoute:route}));
  const catalog=show({kind:'catalog'});
  assert.equal((catalog.match(/In development · Not yet playable/g)||[]).length,11);
  assert.equal((catalog.match(/<h1/g)||[]).length,1);
  assert.match(catalog,/aria-label="Primary navigation"/);
  assert.match(catalog,/aria-current="page"/);
  for(const name of ['About','Accessibility','Games'])assert.ok(catalog.includes(name));
  assert.match(show({kind:'game',slug:'kush-crush'}),/cannot yet be played/);
  assert.match(show({kind:'about'}),/early preview/);
  assert.match(show({kind:'accessibility'}),/reduced-motion/);
  assert.match(show({kind:'not-found'}),/Return to the game catalog/);
  for(const route of [{kind:'game',slug:'kush-crush'},{kind:'about'},{kind:'accessibility'},{kind:'not-found'}])assert.equal((show(route).match(/<h1/g)||[]).length,1);
  assert.doesNotMatch(catalog,/Connect wallet|Play now|Verified score|Buy token/);
 }finally{await vite.close();}
});
