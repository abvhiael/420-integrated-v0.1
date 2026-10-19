import test from 'node:test';
import assert from 'node:assert/strict';
import {PhaserGameAdapter,createPhaser3Factory,ArcadeLifecycleError} from '../src/index.mjs';
import fs from 'node:fs';
const games=JSON.parse(fs.readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url))).games;
const canonical=games.find(g=>g.slug==='bong-breaker');
const manifest=()=>({...canonical});
const dom={appendChild(){}};
const fake=()=>{let destroyed=0,paused=0,resumed=0;const game={destroy(force){assert.equal(force,true);destroyed++;},scene:{pause(){paused++;},resume(){resumed++;}}};return {game,counts:()=>({destroyed,paused,resumed})};};
test('mount, pause, resume, scoped restore/serialize, terminal unmount',async()=>{
 const f=fake(),a=new PhaserGameAdapter({manifest:manifest(),canonical,createEngine:async()=>f.game,scene:{}});
 assert.equal(a.state,'created');assert.equal(await a.mount(dom,{gameId:canonical.gameId}),true);assert.equal(a.state,'running');
 a.pause();assert.equal(a.state,'paused');a.resume();assert.equal(a.state,'running');
 a.restore({gameId:canonical.gameId,contentVersion:canonical.contentVersion,progress:{level:2}});
 assert.equal(a.serialize().progress.level,2);a.unmount();a.unmount();assert.deepEqual(f.counts(),{destroyed:1,paused:1,resumed:1});
 assert.throws(()=>a.pause(),ArcadeLifecycleError);await assert.rejects(a.mount(dom),ArcadeLifecycleError);
});
test('rejects unauthorized manifests and hostile context without creating an engine',async()=>{
 for(const mutate of [x=>x.gameId='FOREIGN',x=>x.slug='kush-crush',x=>x.runtime='react-puzzle',x=>x.registration='REGISTERED',x=>x.walletRequiredForCore=true,x=>x.contentVersion='2.0.0']){
  const m=manifest();mutate(m);assert.throws(()=>new PhaserGameAdapter({manifest:m,canonical,createEngine:()=>{},scene:{}}));
 }
 let called=0;
 for(const context of [{gameId:'foreign'},{signingKey:'key'},{provider:{}},{verifiedScore:true}]){
  const a=new PhaserGameAdapter({manifest:manifest(),canonical,createEngine:()=>{called++;},scene:{}});
  await assert.rejects(a.mount(dom,context));assert.equal(a.state,'created');
 }
 assert.equal(called,0);
});
test('async mount cancelled on unmount destroys stale engine exactly once and never re-enters gameplay',async()=>{
 let resolve;const f=fake();const pending=new Promise(ok=>{resolve=ok});
 const a=new PhaserGameAdapter({manifest:manifest(),canonical,createEngine:()=>pending,scene:{}});
 const loading=a.mount(dom);assert.equal(a.state,'loading');a.unmount();resolve(f.game);
 assert.equal(await loading,false);assert.equal(a.state,'disposed');assert.equal(f.counts().destroyed,1);
});
test('factory failure and invalid engine fail closed; illegal transitions rejected',async()=>{
 for(const createEngine of [async()=>{throw Error('asset failure')},async()=>({destroy(){}})]){
  const a=new PhaserGameAdapter({manifest:manifest(),canonical,createEngine,scene:{}});
  await assert.rejects(a.mount(dom));assert.equal(a.state,'disposed');
 }
 const f=fake(),a=new PhaserGameAdapter({manifest:manifest(),canonical,createEngine:async()=>f.game,scene:{}});
 assert.throws(()=>a.pause());assert.throws(()=>a.serialize());await a.mount(dom);
 assert.throws(()=>a.resume());assert.throws(()=>a.restore({gameId:'foreign',contentVersion:canonical.contentVersion,progress:{}}));
 assert.throws(()=>a.restore({gameId:canonical.gameId,contentVersion:'2.0.0',progress:{}}));a.unmount();
});
test('Phaser-compatible constructor receives scoped settings and rejects invalid engine',async()=>{
 assert.throws(()=>createPhaser3Factory({}));
 let config;
 class Game{constructor(options){config=options;}}
 const factory=createPhaser3Factory({Game,AUTO:0});
 const x=await factory({container:dom,scene:{key:'test'},signal:new AbortController().signal});
 assert.ok(x instanceof Game);assert.equal(config.parent,dom);assert.equal(config.autoFocus,false);assert.equal(config.pauseOnBlur,true);
});
