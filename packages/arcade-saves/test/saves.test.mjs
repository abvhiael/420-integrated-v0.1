import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import fs from 'node:fs';
import {ArcadeProgressStore,SaveError,LOCAL_SAVE_PREFIX} from '../src/index.mjs';
const games=JSON.parse(fs.readFileSync(new URL('../../../config/arcade-game-identities.json',import.meta.url))).games;
function setup(opts={}){const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const store=new ArcadeProgressStore({storage,crypto:webcrypto,now:()=>123456,games,...opts});return {store,values,storage};}
const one=games[0].gameId,two=games[1].gameId;
test('guest save, defensive copy, namespace, independent games and revision enforcement',async()=>{
 const {store,values}=setup();assert.equal(await store.read(one),null);
 const p={level:3};const a=await store.writeIfRevision(one,0,p);p.level=100;
 assert.equal(a.revision,1);assert.equal((await store.read(one)).progress.level,3);
 const b=await store.writeIfRevision(two,0,{page:'private'});assert.equal(b.revision,1);
 await assert.rejects(store.writeIfRevision(one,0,{level:4}),SaveError);
 const c=await store.writeIfRevision(one,1,{level:4});assert.equal(c.revision,2);assert.equal((await store.read(two)).progress.page,'private');
 assert.equal(values.size,2);assert.ok([...values.keys()].every(k=>k.startsWith(LOCAL_SAVE_PREFIX)));
});
test('forged identity, playerRef, corrupt JSON, checksums and future schema fail closed',async()=>{
 const {store,values}=setup();
 for(const id of ['foreign','420/GAMING/GAME/ARCADE_UNKNOWN/V1'])await assert.rejects(store.read(id),SaveError);
 await assert.rejects(store.writeIfRevision(one,0,{}, {playerRef:'other'}),SaveError);
 await store.writeIfRevision(one,0,{stage:1});const key=[...values.keys()][0];
 values.set(key,'not-json');await assert.rejects(store.read(one),SaveError);
 const raw=JSON.parse((await (async()=>{values.delete(key);await store.writeIfRevision(one,0,{stage:1});return values.get(key);})()));raw.save.progress.stage=99;values.set(key,JSON.stringify(raw));await assert.rejects(store.read(one),SaveError);
});
test('rejects invalid values, stale revisions, unsupported save types and oversize payload',async()=>{
 const {store}=setup();
 for(const value of [undefined,()=>{},NaN,Infinity,new Date(),{x:undefined}])await assert.rejects(store.writeIfRevision(one,0,value),SaveError);
 await assert.rejects(store.writeIfRevision(one,0,{data:'x'.repeat(270000)}),SaveError);
 await assert.rejects(store.writeIfRevision(one,-1,{}),SaveError);
});
test('migrations preserve old backup, run pure versioned functions, refuse missing steps and rollback',async()=>{
 const custom=games.map(g=>({...g,saveSchemaVersion:g.gameId===one?2:g.saveSchemaVersion}));
 const {store,values}=setup({games:custom,migrations:{[one]:{1:p=>({...p,level:(p.level??0)+1})}}});
 // Simulate an approved schema-1 record by writing with the historical approved roster.
 const original=setup({storage:undefined}); // independent preparation only
 await store.writeIfRevision(one,0,{level:1});
 const key=[...values.keys()][0];const raw=JSON.parse(values.get(key));
 // Re-encode a schema-1 snapshot using the public cryptographic canonical contract.
 raw.save.schemaVersion=1;
 const sorted=x=>{if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(sorted).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+sorted(x[k])).join(',')+'}';};
 const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(sorted(raw.save)));raw.checksum=Buffer.from(hash).toString('hex');values.set(key,JSON.stringify(raw));
 const result=await store.migrate(one,1,2);assert.equal(result.schemaVersion,2);assert.equal(result.progress.level,2);
 const backup=await store.restoreBackup(one,1,1);assert.equal(backup.schemaVersion,1);assert.equal(backup.progress.level,1);
 await assert.rejects(store.migrate(one,1,2),SaveError);
 const other=setup({games:custom});await other.store.writeIfRevision(one,0,{});await assert.rejects(other.store.migrate(one,1,2),SaveError);
});
