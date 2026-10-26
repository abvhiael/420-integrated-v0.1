// Privileged deploy-only installer. Run using owner credentials, never game HTTP input.
import pg from 'pg';
const [scope,role]=process.argv.slice(2);
if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(scope??'')||!/^hc_social_[a-z0-9_]{1,48}$/.test(role??''))throw Error('invalid trusted scope/role');
const qid=x=>'"'+x.replaceAll('"','""')+'"';
const pool=new pg.Pool({connectionString:process.env.HC_MIGRATION_DATABASE_URL,max:1});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const r=await client.query('SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role]);
 if(r.rows.length!==1||r.rows[0].rolsuper||r.rows[0].rolbypassrls)throw Error('provision restricted runtime role first');
 for(const t of ['highcountry_social_operations','highcountry_social_intents','highcountry_social_events']){
  await client.query('REVOKE ALL ON '+qid(t)+' FROM PUBLIC');
  await client.query('ALTER TABLE '+qid(t)+' FORCE ROW LEVEL SECURITY');
  const policy=role+'_'+t+'_scope';
  await client.query('DROP POLICY IF EXISTS '+qid(policy)+' ON '+qid(t));
  const quotedScope="'"+scope.replaceAll("'","''")+"'";
  await client.query('CREATE POLICY '+qid(policy)+' ON '+qid(t)+' FOR ALL TO '+qid(role)+' USING (scope = '+quotedScope+') WITH CHECK (scope = '+quotedScope+')');
  await client.query('GRANT SELECT, INSERT, UPDATE ON '+qid(t)+' TO '+qid(role));
  await client.query('REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON '+qid(t)+' FROM '+qid(role));
 }
 await client.query('COMMIT');
} catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
