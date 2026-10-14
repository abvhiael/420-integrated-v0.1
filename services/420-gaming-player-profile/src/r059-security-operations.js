// R05.9 durable, multi-instance abuse controls. The operator pool is exclusively
// server-side; auth identity is derived from previously authenticated session.
import {createHmac,randomBytes} from 'node:crypto';
const deny=x=>{throw Object.assign(new Error(x),{code:x});};
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createGamingAbuseGuard420({pool,key,windowSeconds=60,maxRequests=30}={}){
 if(typeof pool?.connect!=='function'||!Buffer.isBuffer(key)||key.length<32||
  !Number.isInteger(windowSeconds)||windowSeconds<10||windowSeconds>3600||
  !Number.isInteger(maxRequests)||maxRequests<1||maxRequests>300)deny('abuse-config-invalid');
 const scope=(accountId,gameId,action)=>createHmac('sha256',key).update(
  JSON.stringify([accountId,gameId,action])).digest('hex');
 return Object.freeze({async consume({accountId,gameId,action,cost=1}={}){
  if(!validId(accountId)||!/^0x[0-9a-f]{64}$/.test(gameId)||!validId(action)||
   !Number.isInteger(cost)||cost<1||cost>maxRequests)deny('abuse-input-invalid');
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed)
    deny('abuse-role-denied');
   await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   const digest=scope(accountId,gameId,action);
   // DB clock and atomic upsert prevent process-local rate limit bypass and
   // racing worker instances. No wallet or raw player IDs stored in counters.
   const row=(await c.query(`INSERT INTO gaming_datastore.abuse_buckets(scope_digest,slot,count)
     VALUES($1,floor(extract(epoch from clock_timestamp()) / $2)::bigint,$3)
     ON CONFLICT (scope_digest,slot) DO UPDATE
       SET count=gaming_datastore.abuse_buckets.count+EXCLUDED.count
     WHERE gaming_datastore.abuse_buckets.count+EXCLUDED.count <= $4
     RETURNING count,slot`,[digest,windowSeconds,cost,maxRequests])).rows[0];
   if(!row){await c.query('COMMIT');deny('abuse-rate-limited');}
   await c.query('COMMIT');
   return Object.freeze({allowed:true,remaining:maxRequests-Number(row.count)});
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }});
}
export function createGamingSecurityTelemetry420({publish,clock=()=>Date.now()}={}){
 if(typeof publish!=='function'||typeof clock!=='function')deny('telemetry-config-invalid');
 const names=new Set(['request','denied','rate_limited','reorg','rpc_error','anti_cheat','secret_unavailable']);
 return Object.freeze({async record(kind,status='observed'){
  if(!names.has(kind)||!['observed','success','failure','blocked'].includes(status))
   deny('telemetry-invalid');
  // Deliberately no account, wallet, token, raw save, tx, credential or query.
  await publish(Object.freeze({service:'highcountry-gaming',kind,status,at:Math.floor(clock()/60000)*60}));
 }});
}
export function createGamingAntiCheatGate420({verifyCanonical,validateCommitment}={}){
 if(typeof verifyCanonical!=='function'||typeof validateCommitment!=='function')
  deny('anti-cheat-config-invalid');
 const B=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
 return Object.freeze({async authorize({gameId,accountId,proof,nonce}={}){
  if(!B(gameId)||!validId(accountId)||!B(proof)||!B(nonce))
   deny('anti-cheat-input-invalid');
  if(await validateCommitment(Object.freeze({gameId,accountId,proof,nonce}))!==true)
   deny('anti-cheat-commitment-rejected');
  if(await verifyCanonical(Object.freeze({gameId,accountId,proof,nonce}))!==true)
   deny('anti-cheat-canonicality-unverified');
  return Object.freeze({accepted:true});
 }});
}
export function requireGamingServerSecret420({load,name}={}){
 if(typeof load!=='function'||typeof name!=='string'||!/^[A-Z0-9_]{3,80}$/.test(name))
  deny('secret-config-invalid');
 return async()=>{
  let secret;
  try{secret=await load(name);}catch{deny('secret-unavailable');}
  if(typeof secret!=='string'||Buffer.byteLength(secret,'utf8')<32)
   deny('secret-unavailable');
  return Buffer.from(secret,'utf8');
 };
}
