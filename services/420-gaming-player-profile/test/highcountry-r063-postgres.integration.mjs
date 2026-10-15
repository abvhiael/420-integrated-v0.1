// Real PostgreSQL / HTTP / encrypted-provider R06.3 local journey.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {GamingDatastoreProvisioner420} from '../src/datastore-provisioning.js';
import {createLocalHighCountryIssuer420} from '../src/highcountry-local-issuer.js';
import {createHighCountryLocalAuthHttp420} from '../src/highcountry-local-auth-http.js';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
import {EncryptedLocalSaveProvider420} from '../src/encrypted-local-save-provider.js';
const url=process.env.HIGHCOUNTRY_R063_POSTGRES_TEST_URL;
if(!url||!new URL(url).pathname.endsWith('/r063_ci'))throw Error('isolated-r063-postgres-required');
const root=new Pool({connectionString:url}),pools=[root],game='0x'+'a'.repeat(64),ruleset='0x'+'b'.repeat(64),policy='0x'+'c'.repeat(64);
const origin='https://game.local.test';
test('registered HTTP principal to real RLS PostgreSQL to encrypted cloud and cross-session restore',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'highcountry-r063-'));
 let authServer,cloudServer;
 try{
  await bootstrapDatastoreRoles(root);await migrateDatastore(root);
  const provision=new GamingDatastoreProvisioner420(root);
  await provision.registerSaveSchema({gameId:game,schemaLabel:'highcountry-guest-preview-v1',schemaNumber:'1'});
  const roleMap=new Map();
  const issuer=createLocalHighCountryIssuer420({gameId:game,provisionAccount:async account=>{
   await provision.provisionAccount(account);
   const role='hc_r063_'+roleMap.size;
   // Operator-only role provisioning; no player endpoint receives DDL authority.
   await root.query('CREATE ROLE '+role+' LOGIN PASSWORD '+"'r063_ci_only'"+' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
   await root.query('GRANT gaming_datastore_runtime TO '+role);
   await provision.bindRuntimeScope({roleName:role,accountId:account.accountId,gameId:game});
   const uri=new URL(url);uri.username=role;uri.password='r063_ci_only';
   const pool=new Pool({connectionString:uri.toString()});pools.push(pool);
   roleMap.set(account.accountId,pool);
  }});
  const profilePool=async ({accountId})=>{const p=roleMap.get(accountId);if(!p)throw Error('account-not-scoped');return p;};
  const provider=new EncryptedLocalSaveProvider420({directory,encryptionKey:randomBytes(32)});
  cloudServer=createHighCountryCloudHttp420({authority:issuer,poolForPrincipal:profilePool,provider,origin});
  authServer=createHighCountryLocalAuthHttp420({issuer,origin});
  await new Promise(ok=>cloudServer.listen(0,'127.0.0.1',ok));
  await new Promise(ok=>authServer.listen(0,'127.0.0.1',ok));
  const cloud='http://127.0.0.1:'+cloudServer.address().port,auth='http://127.0.0.1:'+authServer.address().port;
  const request=async (base,path,{body=null,token=null}={})=>{
   const res=await fetch(base+path,{method:body?'POST':'GET',headers:{origin,
    ...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
   return {code:res.status,json:await res.json()};
  };
  const pwd='highcountry-local-secret-1234';
  assert.equal((await request(auth,'/auth/register',{body:{username:'playerone',password:pwd}})).code,201);
  assert.equal((await request(auth,'/auth/register',{body:{username:'playertwo',password:pwd}})).code,201);
  const token=(await request(auth,'/auth/login',{body:{username:'playerone',password:pwd}})).json.result.token;
  const other=(await request(auth,'/auth/login',{body:{username:'playertwo',password:pwd}})).json.result.token;
  assert.equal((await request(cloud,'/highcountry/session',{token})).json.registered,false);
  assert.equal((await request(cloud,'/highcountry/register',{token,body:{profileId:'plant-farmer',rulesetId:ruleset}})).code,200);
  assert.equal((await request(cloud,'/highcountry/register',{token:other,body:{profileId:'other-farmer',rulesetId:ruleset}})).code,200);
  const consent=(await request(cloud,'/highcountry/consent',{token,body:{policyHash:policy,accepted:true}})).json.consentId;
  const local={schemaVersion:1,rulesetId:ruleset,state:{kind:'untrusted-guest-preview',local:{schema:1,completed:0}}};
  const save=await request(cloud,'/highcountry/save',{token,body:{expectedRevision:'0',consentId:consent,
    schemaLabel:'highcountry-guest-preview-v1',save:local}});
  assert.equal(save.code,200,JSON.stringify(save));assert.equal(save.json.revision,'1');
  assert.equal((await request(cloud,'/highcountry/save',{token:other})).json.save,null,'cross-account isolation');
  assert.equal((await request(cloud,'/highcountry/save',{token})).json.save.state.kind,'untrusted-guest-preview');
  const conflict=await request(cloud,'/highcountry/save',{token,body:{expectedRevision:'0',consentId:consent,
    schemaLabel:'highcountry-guest-preview-v1',save:local}});
  assert.equal(conflict.code,409);
  const logout=await request(auth,'/auth/logout',{body:{},token});assert.equal(logout.code,200);
  assert.equal((await request(cloud,'/highcountry/session',{token})).code,403);
  const second=(await request(auth,'/auth/login',{body:{username:'playerone',password:pwd}})).json.result.token;
  assert.equal((await request(cloud,'/highcountry/save',{token:second})).json.revision,'1');
  const restored=await request(cloud,'/highcountry/restore',{token:second,body:{backupRevision:'1',expectedHead:'1',
    consentId:consent,schemaLabel:'highcountry-guest-preview-v1'}});
  assert.equal(restored.code,200,JSON.stringify(restored));assert.equal(restored.json.revision,'2');
  assert.equal((await request(cloud,'/highcountry/save',{token:second})).json.revision,'2');
  issuer.revokeAccount('playerone');
  assert.equal((await request(cloud,'/highcountry/save',{token:second})).code,403);
 }finally{
  if(authServer?.listening)await new Promise(ok=>authServer.close(ok));
  if(cloudServer?.listening)await new Promise(ok=>cloudServer.close(ok));
  for(const p of pools.reverse())try{await p.end();}catch{}
  await rm(directory,{force:true,recursive:true});
 }
});
