import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('React renders all eleven canonical games as disabled preview cards',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const vite=await createServer({root,server:{middlewareMode:true},appType:'custom'});
 try {
  const {Launcher,validateCatalog}=await vite.ssrLoadModule('/src/App.tsx');
  const html=renderToStaticMarkup(React.createElement(Launcher));
  const names=JSON.parse(read('../../../config/arcade-game-identities.json')).games;
  assert.equal((html.match(/In development · Not yet playable/g)||[]).length,11);
  for(const game of names)assert.ok(html.includes(game.displayName),game.displayName);
  assert.match(html,/aria-live="polite"/);assert.match(html,/id="main"/);assert.match(html,/No games installed/);
  for(const mutate of [g=>g.pop(),g=>g[0].gameId=g[1].gameId,g=>g[0].slug='../bad',g=>g[0].registration='REGISTERED',g=>g[0].walletRequiredForCore=true]) {
   const candidates=structuredClone(names);mutate(candidates);
   assert.throws(()=>validateCatalog(candidates,names.map(g=>g.slug)));
  }
 } finally {await vite.close();}
});
test('pin React and TypeScript/Vite toolchain without wildcard versions',()=>{
 const pkg=JSON.parse(read('../package.json'));
 assert.equal(pkg.dependencies.react,'19.1.0');assert.equal(pkg.devDependencies.typescript,'5.8.3');
 assert.equal(pkg.scripts.typecheck,'tsc --noEmit');assert.equal(pkg.scripts.build,'vite build');
 const lock=JSON.parse(read('../package-lock.json'));
 assert.equal(lock.lockfileVersion,3);assert.equal(lock.packages[''].dependencies.react,'19.1.0');
});
