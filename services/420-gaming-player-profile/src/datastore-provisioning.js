import { DatastoreError,decimal } from './postgres-repository.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const bad=()=>{throw new DatastoreError('invalid-provisioning-input');};
function fields(x,names){if(!x||Object.keys(x).length!==names.length||names.some(n=>!Object.hasOwn(x,n)))bad();}
// Operator-only adapter. Never export through player HTTP/API routes.
export class GamingDatastoreProvisioner420 {
  #pool;
  constructor(pool){if(typeof pool?.connect!=='function')bad();this.#pool=pool;}
  async #run(callback){
    const c=await this.#pool.connect();
    try {
      await c.query('BEGIN');
      const r=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0];
      if(!r.allowed)throw new DatastoreError('provisioning-denied');
      await c.query('SET LOCAL ROLE gaming_datastore_migrator');
      const value=await callback(c);await c.query('COMMIT');return value;
    }catch(e){try{await c.query('ROLLBACK');}catch{};throw e instanceof DatastoreError?e:new DatastoreError('provisioning-conflict');}
    finally{c.release();}
  }
  async provisionAccount(x){
    fields(x,['accountId','issuerRef','credentialCommitment']);
    if(!valid(x.accountId)||!valid(x.issuerRef)||!hash(x.credentialCommitment))bad();
    return this.#run(async c=>{
      await c.query(`INSERT INTO gaming_datastore.accounts(account_id,issuer_ref,credential_commitment)
        VALUES($1,$2,$3) ON CONFLICT(account_id) DO NOTHING`,[x.accountId,x.issuerRef,x.credentialCommitment]);
      const a=(await c.query('SELECT * FROM gaming_datastore.accounts WHERE account_id=$1',[x.accountId])).rows[0];
      if(a.issuer_ref!==x.issuerRef||a.credential_commitment!==x.credentialCommitment)throw new DatastoreError('account-conflict');
      return a;
    });
  }
  async bindRuntimeScope(x){
    fields(x,['roleName','accountId','gameId']);
    if(!/^[a-z][a-z0-9_]{0,62}$/.test(x.roleName)||!valid(x.accountId)||!hash(x.gameId))bad();
    return this.#run(async c=>{
      const r=(await c.query(`SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,
        pg_has_role(rolname,'gaming_datastore_migrator','MEMBER') AS migrator,
        pg_has_role(rolname,'gaming_datastore_runtime','MEMBER') AS runtime FROM pg_roles WHERE rolname=$1`,[x.roleName])).rows[0];
      if(!r||r.rolsuper||r.rolbypassrls||r.rolcreaterole||r.rolcreatedb||r.migrator||!r.runtime)throw new DatastoreError('unsafe-runtime-role');
      const extra=(await c.query(`SELECT 1 FROM pg_roles WHERE rolname NOT IN ($1,'gaming_datastore_runtime')
        AND pg_has_role($1,oid,'MEMBER') LIMIT 1`,[x.roleName])).rows;
      if(extra.length)throw new DatastoreError('unsafe-runtime-role');
      await c.query(`INSERT INTO gaming_datastore.runtime_scopes(role_name,account_id,game_id) VALUES($1,$2,$3)
        ON CONFLICT(role_name) DO NOTHING`,[x.roleName,x.accountId,x.gameId]);
      const s=(await c.query('SELECT * FROM gaming_datastore.runtime_scopes WHERE role_name=$1',[x.roleName])).rows[0];
      if(s.account_id!==x.accountId||s.game_id!==x.gameId)throw new DatastoreError('role-scope-conflict');
      return s;
    });
  }
  async registerSaveSchema(x){
    fields(x,['gameId','schemaLabel','schemaNumber']);
    if(!hash(x.gameId)||!valid(x.schemaLabel))bad();decimal(x.schemaNumber,32,true);
    return this.#run(async c=>{
      await c.query(`INSERT INTO gaming_datastore.save_schemas(game_id,schema_label,schema_number) VALUES($1,$2,$3)
        ON CONFLICT(game_id,schema_label) DO NOTHING`,[x.gameId,x.schemaLabel,x.schemaNumber]);
      const s=(await c.query('SELECT * FROM gaming_datastore.save_schemas WHERE game_id=$1 AND schema_label=$2',[x.gameId,x.schemaLabel])).rows[0];
      if(s.schema_number!==x.schemaNumber)throw new DatastoreError('schema-conflict');return s;
    });
  }
  async disableAccount(accountId){
    if(!valid(accountId))bad();
    return this.#run(async c=>(await c.query(`UPDATE gaming_datastore.accounts SET status='DISABLED',auth_epoch=auth_epoch+1
      WHERE account_id=$1 AND status='ACTIVE' RETURNING account_id,status,auth_epoch`,[accountId])).rows[0]??null);
  }
}
