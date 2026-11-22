import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import pg from 'pg';
import {PostgresRooms} from '../postgres.mjs';
import {makeRoom,joinRoom,startRoom,moveRoom,projectRoom,MatchError} from '../room.mjs';

const host='10000000-0000-4000-8000-000000000001';
const peer='20000000-0000-4000-8000-000000000002';
const outsider='30000000-0000-4000-8000-000000000003';
test('PostgreSQL room row locks, two account privacy, restart, block and stale move race',async t=>{
 if(!process.env.CHAOS_TEST_DATABASE_URL){t.skip('Requires ephemeral Postgres in CCC online CI');return;}
 const pool=new pg.Pool({connectionString:process.env.CHAOS_TEST_DATABASE_URL,max:8});
 t.after(async()=>pool.end());
 await pool.query('CREATE SCHEMA IF NOT EXISTS bg_account_social');
 await pool.query('CREATE TABLE IF NOT EXISTS bg_account_social.members(subject uuid primary key)');
 await pool.query('CREATE TABLE IF NOT EXISTS bg_account_social.blocks(blocker uuid NOT NULL,blocked uuid NOT NULL,PRIMARY KEY(blocker,blocked))');
 await pool.query('TRUNCATE bg_account_social.blocks');
 await pool.query('INSERT INTO bg_account_social.members(subject) VALUES($1),($2),($3) ON CONFLICT DO NOTHING',[host,peer,outsider]);
 const schema=await readFile(resolve(import.meta.dirname,'../../bong-goggles-account-social/migrations/004_chaos_multiplayer.sql'),'utf8');
 await pool.query(schema);
 const r=new PostgresRooms(pool);
 const room=makeRoom(host,'Alice',{humanSeats:2,bots:[]});
 await r.create(room);
 assert.equal((await r.list(host)).length,1);
 assert.equal((await r.list(outsider)).length,0);
 await assert.rejects(()=>r.get(room.id,outsider),e=>e.status===404);
 const joined=await r.join(peer,room.code,'Bobby');
 assert.equal(joined.seat,1);
 assert.equal(joined.joinCode,null);
 assert.equal((await r.list(peer)).length,1);
 await assert.rejects(()=>r.join(outsider,room.code,'Eve'),e=>e.status===409);
 const said=await r.chat(room.id,host,'Ready for the road?');
 assert.equal(said.revision,1,'chat cannot invalidate pending legal move');
 assert.equal(await r.reportChat(room.id,peer,said.chat[0].id),true);
 assert.equal((await r.get(room.id,host)).revision,1);
 assert.equal((await r.get(room.id,host)).chatReports.length,1);
 assert.equal(JSON.stringify(projectRoom(await r.get(room.id,host),host)).includes('chatReports'),false);
 assert.equal((await r.get(room.id,peer)).chat[0].text,'Ready for the road?');
 await assert.rejects(()=>r.chat(room.id,outsider,'intruder'),e=>e.status===404);
 await assert.rejects(()=>r.chat(room.id,host,'flood'),e=>e.status===429);
 const started=await r.mutate(room.id,host,1,x=>startRoom(x,host));
 assert.equal(started.status,'playing');
 const before=await r.get(room.id,peer);
 assert.equal(projectRoom(before,peer).hand.length,7);
 assert.equal(JSON.stringify(projectRoom(before,peer)).includes('deck'),false);
 assert.equal(JSON.stringify(projectRoom(before,host)).includes('seed'),false);
 const outcome=await Promise.allSettled([
  r.mutate(room.id,host,started.revision,x=>moveRoom(x,host,{action:'pass'})),
  r.mutate(room.id,host,started.revision,x=>moveRoom(x,host,{action:'pass'}))
 ]);
 assert.deepEqual(outcome.map(o=>o.status).sort(),['fulfilled','rejected']);
 const bad=outcome.find(o=>o.status==='rejected');
 assert.equal(bad.reason.status,409);
 const restarted=new PostgresRooms(pool);
 const persisted=await restarted.get(room.id,peer);
 assert.equal(persisted.chat[0].text,'Ready for the road?');
 assert.equal(persisted.revision,started.revision+1);
 assert.equal(projectRoom(persisted,peer).legal.length,0);
 await pool.query('INSERT INTO bg_account_social.blocks(blocker,blocked) VALUES($1,$2)',[peer,host]);
 await assert.rejects(()=>restarted.get(room.id,host),e=>e.status===403);
 await assert.rejects(()=>restarted.get(room.id,peer),e=>e.status===403);
 await pool.query('DELETE FROM bg_account_social.blocks WHERE blocker=$1 AND blocked=$2',[peer,host]);
 const valid=await restarted.get(room.id,peer);
 assert.equal(valid.revision,persisted.revision);
});
