import {AuthError,record} from './auth.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function createPostgresOperatorAudit(pool){
 if(typeof pool?.query!=='function')throw new AuthError('AUDIT_UNAVAILABLE',503);
 return Object.freeze({async append(input){
  record(input,['actorId','accountId','tripId','action','result','commandId','at']);
  if(![input.actorId,input.accountId,input.tripId].every(id)||!['monitor','incident.read','incident.resolve'].includes(input.action)||
   !['READ','CANCELLED'].includes(input.result)||!Number.isSafeInteger(input.at)||input.at<0||
   (input.action==='incident.resolve'?!id(input.commandId):input.commandId!==undefined))
   throw new AuthError('INVALID_AUDIT',400);
  try{
   const q=await pool.query(`INSERT INTO liftd.operator_audit(actor_id,account_id,trip_id,action,result,command_id,recorded_at)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (actor_id,command_id) WHERE command_id IS NOT NULL DO NOTHING
    RETURNING id`,[input.actorId,input.accountId,input.tripId,input.action,input.result,input.commandId??null,input.at]);
   if(input.commandId&&q.rowCount===0){
    const prior=await pool.query('SELECT account_id,trip_id,action,result FROM liftd.operator_audit WHERE actor_id=$1 AND command_id=$2',
      [input.actorId,input.commandId]);
    if(prior.rows.length!==1||prior.rows[0].account_id!==input.accountId||prior.rows[0].trip_id!==input.tripId||
      prior.rows[0].action!==input.action||prior.rows[0].result!==input.result)throw new AuthError('AUDIT_IDEMPOTENCY_CONFLICT',409);
   }
   return Object.freeze({recorded:true});
  }catch(e){if(e instanceof AuthError)throw e;throw new AuthError('AUDIT_UNAVAILABLE',503);}
 }});
}
