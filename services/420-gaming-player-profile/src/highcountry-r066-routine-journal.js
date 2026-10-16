// R06.6 durable PostgreSQL at-most-once admission; database uniqueness survives process restarts.
const invalid=x=>{throw Object.assign(new Error(x),{code:x});};
const good=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
export function createHighCountryRoutineJournal420({pool}={}){
 if(typeof pool?.query!=='function')invalid('r066-journal-config-invalid');
 return Object.freeze({claim:async({principal,sessionId,operation,action}={})=>{
  if(![principal,sessionId,operation,action].every(good))invalid('r066-journal-identity-invalid');
  let result;try{result=await pool.query(
   'INSERT INTO gaming_datastore.highcountry_r066_routine_operations (principal,session_id,operation,action) VALUES ($1,$2,$3,$4) ON CONFLICT (principal,session_id,operation) DO NOTHING RETURNING operation',
   [principal,sessionId,operation,action]);}catch{invalid('r066-journal-unavailable');}
  if(result?.rowCount===1)return true;
  if(result?.rowCount===0)return false;
  invalid('r066-journal-malformed');
 }});
}
