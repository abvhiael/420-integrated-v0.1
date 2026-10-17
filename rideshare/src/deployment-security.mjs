import {createHash} from 'node:crypto';
import {checkSchema} from './schema.mjs';

const fail = code => {throw Object.assign(new Error(code),{code});};
const safe = value => typeof value==='string' && value.length>0 && value.length<4096;
const pin = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const int = value => Number.isSafeInteger(value) && value>0;

/** Fail-closed config, with no secret values included in errors or returned attestations. */
export function validateDeploymentConfig(config) {
 if(!config || typeof config!=='object' || Array.isArray(config))fail('DEPLOY_CONFIG_INVALID');
 const required=['environment','publicOrigin','databaseUrl','databaseRole','tlsMode','secretProvider','identityKeyDigest','sessionKeyDigest','locationKeyDigest','releaseSha'];
 if(required.some(k=>!safe(config[k])))fail('DEPLOY_CONFIG_MISSING');
 if(config.environment!=='production' && config.environment!=='testnet')fail('DEPLOY_ENVIRONMENT_INVALID');
 const url=new URL(config.publicOrigin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname||url.hostname==='localhost')fail('DEPLOY_TLS_REQUIRED');
 const db=new URL(config.databaseUrl);
 if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname||!db.username||!db.password||db.searchParams.get('sslmode')!=='verify-full')fail('DEPLOY_DATABASE_TLS_REQUIRED');
 if(config.databaseRole=== 'postgres'||config.databaseRole==='superuser'||!/^liftd_[a-z0-9_]{3,60}$/.test(config.databaseRole)||db.username!==config.databaseRole)fail('DEPLOY_DATABASE_ROLE_INVALID');
 if(config.tlsMode!=='trusted-terminator' && config.tlsMode!=='native')fail('DEPLOY_TLS_REQUIRED');
 if(config.secretProvider!=='managed' || !pin(config.identityKeyDigest)||!pin(config.sessionKeyDigest)||!pin(config.locationKeyDigest)||config.identityKeyDigest===config.sessionKeyDigest||config.locationKeyDigest===config.sessionKeyDigest)fail('DEPLOY_KEYS_UNTRUSTED');
 if(!/^[a-f0-9]{40}$/.test(config.releaseSha))fail('DEPLOY_RELEASE_UNPINNED');
 if(config.enableDispatch!==false||config.enablePayments!==false||config.enablePassengerTraffic!==false)fail('DEPLOY_EXTERNAL_AUTHORITY_REQUIRED');
 const limits=config.limits;
 if(!limits||!int(limits.requestBytes)||limits.requestBytes>1048576||!int(limits.timeoutMs)||limits.timeoutMs>30000)fail('DEPLOY_LIMITS_INVALID');
 return Object.freeze({environment:config.environment,origin:url.origin,dbHost:db.hostname,role:config.databaseRole,tlsMode:config.tlsMode,secretProvider:'managed',releaseSha:config.releaseSha,trafficEnabled:false,configDigest:createHash('sha256').update(JSON.stringify({environment:config.environment,origin:url.origin,role:config.databaseRole,tlsMode:config.tlsMode,releaseSha:config.releaseSha,limits})).digest('hex')});
}

/** Only report readiness after connectivity, migration checksum, and role privilege checks. */
export async function assessReadiness(pool,{minimumMigrations=15}={}) {
 if(typeof pool?.connect!=='function'||!int(minimumMigrations))fail('DEPLOY_DATABASE_UNAVAILABLE');
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout='3s'");
  await checkSchema(client);
  const role=(await client.query("SELECT current_user AS role, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user")).rows[0];
  if(!role||role.rolsuper||role.rolcreatedb||role.rolcreaterole||!/^liftd_[a-z0-9_]+$/.test(role.role))fail('DEPLOY_DATABASE_PRIVILEGE_DENIED');
  const permissions=(await client.query(`SELECT
   has_schema_privilege(current_user,'liftd','USAGE') AS schema_use,
   has_schema_privilege(current_user,'liftd','CREATE') AS schema_create,
   has_table_privilege(current_user,'liftd.trips','SELECT') AS can_read,
   has_table_privilege(current_user,'liftd.trips','TRUNCATE') AS can_truncate,
   has_table_privilege(current_user,'liftd.migrations','INSERT') AS can_mutate_migrations
  `)).rows[0];
  if(!permissions||!permissions.schema_use||permissions.schema_create||!permissions.can_read||permissions.can_truncate||permissions.can_mutate_migrations)fail('DEPLOY_DATABASE_PRIVILEGE_DENIED');
  const result=await client.query('SELECT count(*)::int AS count FROM liftd.migrations');
  if(Number(result.rows[0]?.count)<minimumMigrations)fail('DEPLOY_MIGRATIONS_INCOMPLETE');
  await client.query('COMMIT');
  return Object.freeze({ready:true,role:role.role,appliedMigrations:Number(result.rows[0].count)});
 }catch(e){try{await client.query('ROLLBACK')}catch{};throw e}
 finally{client.release()}
}
export function verifyReleaseAsset(buffer,sha256){
 if(!pin(sha256)||!Buffer.isBuffer(buffer)||createHash('sha256').update(buffer).digest('hex')!==sha256)fail('DEPLOY_ARTIFACT_INTEGRITY');
 return true;
}
