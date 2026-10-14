// SQL owner should use a restricted server role. Not exposed to public discovery/Indexer.
export function createPostgresDriverOnboardingStore(pool) {
 if(!pool||typeof pool.connect!=='function'||typeof pool.query!=='function')throw Error('DATABASE_UNAVAILABLE');
 return Object.freeze({
  async read(id){
   const r=await pool.query('SELECT revision,payload FROM liftd.driver_onboarding WHERE driver_id=$1',[id]);
   if(!r.rows.length)return null;
   return {...r.rows[0].payload,revision:Number(r.rows[0].revision)};
  },
  async writeCAS(id,revision,commandId,row){
   const db=await pool.connect();
   try{
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout='3s'");
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['liftd:onboarding:'+id]);
    const old=await db.query('SELECT revision FROM liftd.driver_onboarding WHERE driver_id=$1 FOR UPDATE',[id]);
    if(Number(old.rows[0]?.revision??0)!==revision){await db.query('ROLLBACK');return false;}
    const replay=await db.query('SELECT 1 FROM liftd.driver_onboarding_commands WHERE driver_id=$1 AND command_id=$2',[id,commandId]);
    if(replay.rows.length){await db.query('ROLLBACK');return false;}
    if(old.rows.length)await db.query('UPDATE liftd.driver_onboarding SET revision=$2,payload=$3::jsonb,updated_at=now() WHERE driver_id=$1',[id,revision+1,JSON.stringify(row)]);
    else await db.query('INSERT INTO liftd.driver_onboarding(driver_id,revision,payload) VALUES($1,1,$2::jsonb)',[id,JSON.stringify(row)]);
    await db.query('INSERT INTO liftd.driver_onboarding_commands(driver_id,command_id,revision) VALUES($1,$2,$3)',[id,commandId,revision+1]);
    await db.query('COMMIT');return true;
   }catch(e){try{await db.query('ROLLBACK');}catch{}throw e;}
   finally{db.release();}
  }
 });
}
