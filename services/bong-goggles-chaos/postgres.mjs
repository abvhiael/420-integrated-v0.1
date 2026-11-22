// Durable, transaction-serialized PostgreSQL room storage. The server role needs
// only SELECT/INSERT/UPDATE on chaos_rooms and SELECT/INSERT on chaos_room_members.
// No user tokens, 420ID email, wallet addresses, wagers, or server secrets are stored.
import {assertRoomShape,joinRoom,summarizeRoom,projectRoom,validateRevision,appendChaosChat,MatchError} from './room.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class PostgresRooms{
 constructor(pool){this.pool=pool;}
 async guarded(actor,room){
  const people=room.seats.filter(s=>s.subject&&s.subject!==actor).map(s=>s.subject);
  if(people.length===0)return;
  const res=await this.pool.query('SELECT 1 FROM bg_account_social.blocks WHERE (blocker=$1 AND blocked=ANY($2::uuid[])) OR (blocked=$1 AND blocker=ANY($2::uuid[])) LIMIT 1',[actor,people]);
  if(res.rowCount)throw new MatchError(403,'A participant is blocked');
 }
 async create(room){
  assertRoomShape(room);
  const c=await this.pool.connect();
  try{
   await c.query('BEGIN');
   await c.query('INSERT INTO bg_account_social.chaos_rooms(id,join_code,host,status,revision,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
    [room.id,room.code,room.host,room.status,room.revision,JSON.stringify(room)]);
   await c.query('INSERT INTO bg_account_social.chaos_room_members(room_id,subject,seat) VALUES($1,$2,0)',[room.id,room.host]);
   await c.query('COMMIT');return room;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async list(actor){
  const rows=await this.pool.query('SELECT r.data FROM bg_account_social.chaos_rooms r JOIN bg_account_social.chaos_room_members m ON m.room_id=r.id WHERE m.subject=$1 ORDER BY r.updated_at DESC LIMIT 50',[actor]);
  const results=[];
  for(const record of rows.rows){
   const room=assertRoomShape(record.data);
   await this.guarded(actor,room);
   results.push(summarizeRoom(room,actor));
  }
  return results;
 }
 async get(id,actor){
  if(!UUID.test(id))throw new MatchError(404,'Match not found');
  const r=await this.pool.query('SELECT r.data FROM bg_account_social.chaos_rooms r JOIN bg_account_social.chaos_room_members m ON m.room_id=r.id WHERE r.id=$1 AND m.subject=$2',[id,actor]);
  if(r.rowCount!==1)throw new MatchError(404,'Match not found');
  const room=assertRoomShape(r.rows[0].data);
  await this.guarded(actor,room);
  return room;
 }
 async mutate(id,actor,revision,apply,{code=null}={}){
  const c=await this.pool.connect();
  try{
   await c.query('BEGIN');
   const r=await c.query(code?
    'SELECT data FROM bg_account_social.chaos_rooms WHERE join_code=$1 FOR UPDATE':
    'SELECT data FROM bg_account_social.chaos_rooms WHERE id=$1 FOR UPDATE',[code||id]);
   if(r.rowCount!==1)throw new MatchError(404,'Match not found');
   const previous=assertRoomShape(r.rows[0].data);
   if(code===null&&!previous.seats.some(s=>s.subject===actor))throw new MatchError(404,'Match not found');
   await this.guarded(actor,previous);
   if(code===null)validateRevision(previous,revision);
   const next=assertRoomShape(apply(previous));
   if(next.id!==previous.id||next.host!==previous.host||next.revision<previous.revision)throw new MatchError(503,'Invalid room update');
   if(next===previous){await c.query('COMMIT');return previous;}
   const oldSeat=previous.seats.findIndex(s=>s.subject===actor),newSeat=next.seats.findIndex(s=>s.subject===actor);
   if(oldSeat<0&&newSeat>=0){
    await c.query('INSERT INTO bg_account_social.chaos_room_members(room_id,subject,seat) VALUES($1,$2,$3)',[next.id,actor,newSeat]);
   }
   const updated=await c.query('UPDATE bg_account_social.chaos_rooms SET data=$2::jsonb,revision=$3,status=$4,updated_at=clock_timestamp() WHERE id=$1 AND revision=$5',[next.id,JSON.stringify(next),next.revision,next.status,previous.revision]);
   if(updated.rowCount!==1)throw new MatchError(409,'Match revision has changed');
   await c.query('COMMIT');return next;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 // Chat is serialized on the room row but does not advance game revisions.
 // This prevents messages from invalidating an otherwise legal gameplay move.
 async chat(id,actor,text){
  if(!UUID.test(id))throw new MatchError(404,'Match not found');
  const c=await this.pool.connect();
  try{
   await c.query('BEGIN');
   const member=await c.query('SELECT 1 FROM bg_account_social.chaos_room_members WHERE room_id=$1 AND subject=$2',[id,actor]);
   if(member.rowCount!==1)throw new MatchError(404,'Match not found');
   const r=await c.query('SELECT data FROM bg_account_social.chaos_rooms WHERE id=$1 FOR UPDATE',[id]);
   if(r.rowCount!==1)throw new MatchError(404,'Match not found');
   const previous=assertRoomShape(r.rows[0].data);
   await this.guarded(actor,previous);
   const next=appendChaosChat(previous,actor,text);
   const saved=await c.query('UPDATE bg_account_social.chaos_rooms SET data=$2::jsonb,updated_at=clock_timestamp() WHERE id=$1 AND revision=$3',[id,JSON.stringify(next),previous.revision]);
   if(saved.rowCount!==1)throw new MatchError(409,'Match revision has changed');
   await c.query('COMMIT');
   return next;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async join(actor,code,name,revision){
  if(typeof code!=='string'||!/^[a-zA-Z0-9_-]{32}$/.test(code))throw new MatchError(400,'Invalid invite code');
  // The code is an unguessable invite capability, not an account identifier.
  const result=await this.mutate(null,actor,revision,old=>joinRoom(old,actor,name),{code});
  return projectRoom(result,actor);
 }
}
