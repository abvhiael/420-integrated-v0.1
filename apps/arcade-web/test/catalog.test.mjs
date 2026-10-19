import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('../',import.meta.url));
const roster=JSON.parse((await import('node:fs')).readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url),'utf8')).games;
test('canonical discovery, categories, casefold search, zero result and adversarial filters',async()=>{
 const vite=await createServer({root,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{
 const {discoverGames,categoryOf,launchEligibility}=await vite.ssrLoadModule('/src/App.tsx');
 assert.equal(discoverGames(roster,'').length,11);
 assert.deepEqual(discoverGames(roster,'  KUSH  ').map(g=>g.slug),['kush-crush']);
 assert.deepEqual(discoverGames(roster,'dave').map(g=>g.slug),['wheres-dave']);
 assert.deepEqual(discoverGames(roster,'NONEXISTENT'),[]);
 assert.equal(discoverGames(roster,'','action').length,7);
 for(const filter of ['puzzle','creative','companion','exploration'])assert.equal(discoverGames(roster,'',filter).length,1);
 assert.equal(categoryOf(roster[0]),'puzzle');
 assert.throws(()=>discoverGames(roster,'','<script>'));
 assert.throws(()=>launchEligibility({...roster[0],gameId:'untrusted'}));
 for(const game of roster)assert.deepEqual(launchEligibility(game),{canLaunch:false,reason:'Game runtime not installed'});
 }finally{await vite.close();}
});
test('catalog renders functional discovery interface and detail launch is disabled',async()=>{
 const vite=await createServer({root,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{
 const {Launcher}=await vite.ssrLoadModule('/src/App.tsx');
 const catalog=renderToStaticMarkup(React.createElement(Launcher,{initialRoute:{kind:'catalog'}}));
 assert.match(catalog,/role="search"/);assert.match(catalog,/id="game-search"/);assert.match(catalog,/id="game-category"/);
 assert.match(catalog,/11 of 11 games shown/);
 assert.equal((catalog.match(/In development · Not yet playable/g)||[]).length,11);
 assert.equal((catalog.match(/View details/g)||[]).length,11);
 const detail=renderToStaticMarkup(React.createElement(Launcher,{initialRoute:{kind:'game',slug:'kush-crush'}}));
 assert.match(detail,/Launch game/);assert.match(detail,/disabled=""/);assert.match(detail,/Game runtime not installed/);
 assert.doesNotMatch(detail,/verified score|WalletConnect|eth_sendTransaction/i);
 }finally{await vite.close();}
});
