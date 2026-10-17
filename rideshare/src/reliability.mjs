import {randomBytes} from 'node:crypto';
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=code=>{throw Object.assign(new Error(code),{code})};
const types=new Set(['dispatch_reconcile','availability_sweep','provider_recheck']);
export function createRecoveryQueue(pool,{leaseSeconds=30,maxAttempts=5}={}){
 if(typeof pool?.connect!=='function'||!Number.isInteger(leaseSeconds)||leaseSeconds<1||leaseSeconds>300||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)fail('QUEUE_CONFIGURATION_INVALID');
 async function transaction(fn){
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='5s'");const v=await fn(c);await c.query('COMMIT');return v}catch(e){try{await c.query('ROLLBACK')}catch{};throw e}finally{c.release()}
 }
 return Object.freeze({
  async enqueue({jobId,kind,subjectId,payload={}}){
   if(!ident(jobId)||!ident(subjectId)||!types.has(kind)||!payload||Array.isArray(payload)||typeof payload!=='object')fail('QUEUE_REQUEST_INVALID');
   return transaction(async c=>{
    const q=await c.query("INSERT INTO liftd.recovery_jobs(job_id,kind,subject_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(job_id) DO NOTHING RETURNING job_id",[jobId,kind,subjectId,payload]);
    if(q.rowCount===0){const prior=(await c.query('SELECT kind,subject_id,payload FROM liftd.recovery_jobs WHERE job_id=$1',[jobId])).rows[0];if(!prior||prior.kind!==kind||prior.subject_id!==subjectId||JSON.stringify(prior.payload)!==JSON.stringify(payload))fail('QUEUE_IDEMPOTENCY_CONFLICT')}
    return jobId;
   });
  },
  async claim(workerId){
   if(!ident(workerId))fail('QUEUE_WORKER_INVALID');
   return transaction(async c=>{
    const token=randomBytes(24).toString('base64url');
    const row=await c.query(`WITH eligible AS (
      SELECT job_id FROM liftd.recovery_jobs
      WHERE (state='queued' AND available_at<=now()) OR (state='leased' AND lease_until<=now())
      ORDER BY available_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE liftd.recovery_jobs j SET state='leased',lease_owner=$1,lease_token=$2,
       lease_until=now()+($3 * interval '1 second'),attempts=j.attempts+1
    FROM eligible WHERE j.job_id=eligible.job_id
    RETURNING j.job_id,j.kind,j.subject_id,j.payload,j.attempts,j.lease_token`,[workerId,token,leaseSeconds]);
    return row.rows[0]??null;
   });
  },
  async finish({jobId,workerId,token,ok,errorCode='PROVIDER_UNAVAILABLE'}){
   if(!ident(jobId)||!ident(workerId)||typeof token!=='string'||!/^[-_A-Za-z0-9]{32}$/.test(token)||typeof ok!=='boolean'||(!ok&&!ident(errorCode)))fail('QUEUE_RESULT_INVALID');
   return transaction(async c=>{
    const q=await c.query(`UPDATE liftd.recovery_jobs
      SET state=CASE WHEN $4 THEN 'complete' WHEN attempts >= $6 THEN 'dead' ELSE 'queued' END,
      available_at=CASE WHEN NOT $4 THEN now()+(LEAST(300,POWER(2,LEAST(attempts,8))::integer)*interval '1 second') ELSE available_at END,
      lease_owner=NULL,lease_token=NULL,lease_until=NULL,last_error=CASE WHEN $4 THEN NULL ELSE $5 END
      WHERE job_id=$1 AND lease_owner=$2 AND lease_token=$3 AND state='leased' AND lease_until>now()
      RETURNING job_id,state`,[jobId,workerId,token,ok,errorCode,maxAttempts]);
    if(q.rowCount!==1)fail('QUEUE_STALE_LEASE');
    return q.rows[0].state;
   });
  },
 });
}
export function createProviderGuard(operation,{timeoutMs=2000,failures=3,cooldownMs=10000,clock=()=>Date.now()}={}){
 if(typeof operation!=='function'||![timeoutMs,failures,cooldownMs].every(Number.isSafeInteger)||timeoutMs<1||timeoutMs>30000||failures<1||failures>20||cooldownMs<1)fail('PROVIDER_GUARD_INVALID');
 let count=0,blockedUntil=0;
 return async (...args)=>{
  const now=clock();if(now<blockedUntil)fail('PROVIDER_CIRCUIT_OPEN');
  const ctrl=new AbortController();
  let timer;
  try{
   const result=await Promise.race([Promise.resolve().then(()=>operation(...args,ctrl.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{ctrl.abort();reject(Object.assign(new Error('PROVIDER_TIMEOUT'),{code:'PROVIDER_TIMEOUT'}))},timeoutMs)})]);
   count=0;blockedUntil=0;return result;
  }catch(e){if(++count>=failures)blockedUntil=clock()+cooldownMs;throw e}
  finally{clearTimeout(timer)}
 };
}
