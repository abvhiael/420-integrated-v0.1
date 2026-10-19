import test from 'node:test';import assert from 'node:assert/strict';import {UniversalGameControls,ArcadeControlError,validateSettings} from '../src/index.mjs';
const gameId='420/GAMING/GAME/ARCADE_BONG_BREAKER/V1';const container={appendChild(){}};
function make(){
 const stats={created:0,mounts:0,unmounts:0,inputEnabled:0,inputDisabled:0,audioPaused:0,audioResumed:0,volume:[],mute:[]};
 const createGame=async()=>{stats.created++;return {gameId,state:'created',async mount(){stats.mounts++;this.state='running';return true;},pause(){this.state='paused';},resume(){this.state='running';},unmount(){stats.unmounts++;this.state='disposed';}}};
 const input={gameId,enable(){stats.inputEnabled++;},disable(){stats.inputDisabled++;}};
 const audio={gameId,pause(){stats.audioPaused++;},resume(){stats.audioResumed++;},setVolume:v=>stats.volume.push(v),setMuted:v=>stats.mute.push(v)};
 const events=[];const control=new UniversalGameControls({gameId,createGame,input,audio,onStatus:s=>events.push(s)});
 return {control,stats,events};
}
test('mount pause resume restart fresh session and dispose',async()=>{
 const {control,stats}=make();assert.equal(await control.mount(container),true);assert.equal(control.state,'running');
 control.pause();assert.equal(control.state,'paused');control.resume();assert.equal(control.state,'running');
 await control.restart();assert.equal(control.state,'running');assert.equal(stats.created,2);assert.equal(stats.unmounts,1);
 control.dispose();control.dispose();assert.equal(stats.unmounts,2);assert.equal(control.state,'disposed');
 assert.throws(()=>control.resume(),ArcadeControlError);assert.equal(stats.audioPaused>=2,true);
});
test('settings finite range, booleans, allowlist and audio propagation',async()=>{
 const {control,stats}=make();await control.mount(container);
 assert.deepEqual(control.updateSettings({volume:0.8,muted:false,reducedMotion:true,highContrast:true}),{volume:0.8,muted:false,reducedMotion:true,highContrast:true});
 assert.deepEqual(stats.volume,[0.8]);assert.deepEqual(stats.mute,[false]);
 for(const patch of [{volume:2},{muted:'false'},{constructor:'evil'},{extra:true}])assert.throws(()=>control.updateSettings(patch),ArcadeControlError);
 assert.throws(()=>validateSettings({volume:NaN}),ArcadeControlError);control.dispose();
});
test('refuses foreign game, duplicate mount, illegal transition and restart while idle',async()=>{
 assert.throws(()=>new UniversalGameControls({gameId,createGame:async()=>{},input:{gameId:'foreign'}}),ArcadeControlError);
 const {control}=make();assert.throws(()=>control.pause(),ArcadeControlError);await assert.rejects(control.restart(),ArcadeControlError);
 await control.mount(container);await assert.rejects(control.mount(container),ArcadeControlError);assert.throws(()=>control.resume(),ArcadeControlError);control.dispose();
});
test('mount failure cleans up and restart recovers without leaking previous instance',async()=>{
 let count=0,unmounts=0;const c=new UniversalGameControls({gameId,createGame:async()=>{count++;return {gameId,state:'created',async mount(){if(count===1)throw Error('load failure');this.state='running';return true;},pause(){this.state='paused'},resume(){this.state='running'},unmount(){unmounts++;this.state='disposed'}}}});
 await assert.rejects(c.mount(container),/load failure/);assert.equal(c.state,'error');
 assert.equal(await c.restart(),true);assert.equal(c.state,'running');assert.equal(unmounts,1);c.dispose();assert.equal(unmounts,2);
});
test('no game can mount after dispose during delayed factory',async()=>{
 let release;const wait=new Promise(resolve=>{release=resolve});let torn=0;
 const c=new UniversalGameControls({gameId,createGame:async()=>wait});
 const pending=c.mount(container);c.dispose();
 release({gameId,state:'created',unmount(){torn++},mount(){throw Error('stale')}});assert.equal(await pending,false);assert.equal(torn,1);assert.equal(c.state,'disposed');
});
