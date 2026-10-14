import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_KEY,newGuest,plant,stage,setEnvironment,advance,harvest,loadGuest,saveGuest,grade} from '../src/guest.js';
const day=86400000;const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),m};};
test('guest lifecycle, persistence and offline return without wallet or account',()=>{
 const st=store(),t=1000000000000;
 const a=plant(newGuest(t),t);
 saveGuest(st,a);assert.equal(loadGuest(st).plant.id,a.plant.id);
 assert.equal(stage(a.plant,t),'germination');assert.equal(stage(a.plant,t+day),'seedling');
 assert.equal(stage(a.plant,t+3*day),'vegetative');assert.equal(stage(a.plant,t+10*day),'flowering');assert.equal(stage(a.plant,t+17*day),'ready');
 const b=advance(loadGuest(st),t+18*day);
 assert.equal(stage(b.plant,b.lastSeen),'ready');const done=harvest(b,t+18*day);
 assert.equal(done.completed,1);assert.equal(done.harvests[0].massMg,100000);assert.equal(done.harvests[0].localOnly,true);
 assert.throws(()=>harvest(done,t+18*day),/plant-not-ready/);
 saveGuest(st,done);assert.equal(loadGuest(st).completed,1);
});
test('environment validation, ready sealing and rollback protections',()=>{
 const t=1000000000000,a=plant(newGuest(t),t);
 assert.throws(()=>setEnvironment(a,{water:10001},t+1));
 assert.throws(()=>setEnvironment(a,{walletBoost:10},t+1));
 const b=setEnvironment(a,{water:7000,temperature:3500},t+1);
 assert.equal(b.plant.env.water,7000);
 assert.throws(()=>advance(b,t),/clock-rollback/);
 assert.throws(()=>setEnvironment(b,{water:8000},t+17*day),/environment-sealed/);
 assert.throws(()=>harvest(b,t+5*day),/plant-not-ready/);
});
test('save corruption/storage failures and grade boundary vectors',()=>{
 const s=store();s.m.set(SAVE_KEY,'{');assert.throws(()=>loadGuest(s),/corrupt/);
 assert.throws(()=>loadGuest({getItem(){throw Error('denied');}}),/unavailable/);
 assert.throws(()=>saveGuest({setItem(){throw Error('quota');}},newGuest(10)),/write-failed/);
 for(const [q,g] of [[0,'D'],[2499,'D'],[2500,'C'],[4999,'C'],[5000,'B'],[7499,'B'],[7500,'A'],[8999,'A'],[9000,'S'],[10000,'S']])assert.equal(grade(q),g);
});
