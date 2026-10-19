import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ReactCasualAdapter,CasualLifecycleError,validateCasualManifest} from '../src/react-casual.mjs';
const games=JSON.parse(fs.readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url),'utf8')).games;
const canonical=games[0],dom={appendChild(){}};
const factory=()=>{let unmounts=0;const renders=[];return {renderer:async()=>({render:x=>renders.push(x),unmount:()=>{unmounts++;}}),status:()=>({unmounts,renders})};};
const create=(f,game=canonical)=>new ReactCasualAdapter({manifest:{...game},canonical:game,renderView:f,view:()=>null});
test('mount, pause, resume, serialize, restore and terminal destruction',async()=>{
 const f=factory(),a=create(f.renderer);
 assert.equal(a.state,'created');assert.equal(await a.mount(dom,{gameId:canonical.gameId}),true);
 assert.equal(a.state,'running');a.pause();assert.equal(a.state,'paused');
 a.restore({gameId:canonical.gameId,contentVersion:canonical.contentVersion,schemaVersion:1,progress:{level:2}});
 assert.equal(a.serialize().progress.level,2);a.resume();a.unmount();a.unmount();
 assert.equal(f.status().unmounts,1);assert.equal(f.status().renders.length,3);
 assert.throws(()=>a.pause(),CasualLifecycleError);await assert.rejects(a.mount(dom));
});
test('both approved React casual games valid, all other games fail',()=>{
 for(const game of games){const f=()=>({render(){},unmount(){}});if(['kush-crush','420buddy'].includes(game.slug))assert.doesNotThrow(()=>create(f,game));else assert.throws(()=>create(f,game),CasualLifecycleError);}
});
test('foreign, unsafe, version mismatch and malformed manifests fail closed',async()=>{
 const f=()=>({render(){},unmount(){}});
 for(const mutate of [m=>m.gameId='foreign',m=>m.slug='../../admin',m=>m.runtime='phaser',m=>m.registration='REGISTERED',m=>m.walletRequiredForCore=true,m=>m.rulesetVersion='9.0.0',m=>m.saveSchemaVersion=99]){
  const m={...canonical};mutate(m);assert.throws(()=>validateCasualManifest(m,canonical),CasualLifecycleError);
 }
 for(const context of [{gameId:'foreign'},{provider:null},{wallet:null},{signingKey:'x'},{verifiedScore:false},{registry:{}}]){
  let calls=0;const a=create(()=>{calls++;return f()});await assert.rejects(a.mount(dom,context));assert.equal(calls,0);
 }
});
test('stale async mount cannot resurrect disposed React root',async()=>{
 let release;let unmounts=0;const pending=new Promise(ok=>{release=ok});
 const a=create(()=>pending);const mounting=a.mount(dom);assert.equal(a.state,'loading');a.unmount();
 release({render(){},unmount(){unmounts++;}});
 assert.equal(await mounting,false);assert.equal(a.state,'disposed');assert.equal(unmounts,1);
});
test('renderer errors and invalid root close lifecycle; failed restore preserves progress',async()=>{
 const a=create(async()=>{throw Error('load failure')});await assert.rejects(a.mount(dom),/load failure/);assert.equal(a.state,'disposed');
 const b=create(async()=>({unmount(){}}));await assert.rejects(b.mount(dom),CasualLifecycleError);assert.equal(b.state,'disposed');
 const f=factory(),c=create(f.renderer);await c.mount(dom);
 for(const s of [{gameId:'foreign',contentVersion:'1.0.0',schemaVersion:1,progress:{}},{gameId:canonical.gameId,contentVersion:'2.0.0',schemaVersion:1,progress:{}},{gameId:canonical.gameId,contentVersion:'1.0.0',schemaVersion:2,progress:{}}])assert.throws(()=>c.restore(s),CasualLifecycleError);
 assert.equal(c.serialize().progress,null);c.unmount();
});
