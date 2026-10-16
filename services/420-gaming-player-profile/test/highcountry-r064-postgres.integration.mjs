import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {migrateWalletLinks} from '../src/wallet-link-migrations.js';
import {GamingDatastoreProvisioner420} from '../src/datastore-provisioning.js';
import {PostgresGamingRepository420} from '../src/postgres-repository.js';
import {createHighCountryWalletService420} from '../src/wallet-link-service.js';
import {createHighCountryScopedFeatures420} from '../src/highcountry-r064-feature-http.js';
const url=process.env.HIGHCOUNTRY_R064_PG_URL;
if(!url||!new URL(url).pathname.endsWith('/r064_ci'))throw Error('isolated R06.4 PostgreSQL required');
const root=new Pool({connectionString:url}),pools=[root];
const H=x=>'0x'+x.repeat(64),W='0x'+'a'.repeat(40);
const G=H('1'),R=H('2'),P=H('3'),F=H('4'),B=H('5'),E=H('6');
test('R06.4 real scoped PostgreSQL link and independent canonical proof gateway boundaries',async()=>{
 let revoked=false;
 const auth={gameId:G,verifyToken:token=>{if(revoked||!['alpha','beta'].includes(token))throw Error('denied');return {sub:token,game:G,iss:'issuer_r064',epoch:0};},
  registeredPrincipal:async token=>{if(revoked||!['alpha','beta'].includes(token))throw Error('denied');return token;}};
 try{
  await bootstrapDatastoreRoles(root);await migrateDatastore(root);await migrateWalletLinks(root);
  const provision=new GamingDatastoreProvisioner420(root),scopes={};
  for(const id of ['alpha','beta']){
   await provision.provisionAccount({accountId:id,issuerRef:'issuer_r064',credentialCommitment:P});
   const role='r064_'+id;
   await root.query('CREATE ROLE '+role+" LOGIN PASSWORD 'r064_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
   await root.query('GRANT gaming_datastore_runtime TO '+role);
   await provision.bindRuntimeScope({roleName:role,accountId:id,gameId:G});
   const u=new URL(url);u.username=role;u.password='r064_only';
   scopes[id]=new Pool({connectionString:u.toString()});pools.push(scopes[id]);
   const repo=new PostgresGamingRepository420({pool:scopes[id],accountId:id,gameId:G,
    expectedEpoch:'0',expectedIssuerRef:'issuer_r064'});
   await repo.transaction(tx=>tx.createProfile({profileId:'profile-'+id,rulesetId:R}));
  }
  const walletService=createHighCountryWalletService420({authority:auth,
   poolForPrincipal:async({accountId})=>scopes[accountId],
   clientsByChain:new Map([['420',{getChainId:async()=>420,verifyMessage:async()=>true}]]),
   domain:'highcountry_r064'});
  const challenge=await walletService.issueChallenge('alpha',
   {wallet:W,chainId:'420',consentId:'signed_consent',policyHash:P,consentAccepted:true});
  await walletService.completeLink('alpha',{challengeId:challenge.challengeId,signature:'0x'+'aa'.repeat(65)});
  const canonical={ownership:async({wallet,profileId})=>{
    assert.equal(wallet,W);assert.equal(profileId,F);
    return {accepted:true,kind:'OWNERSHIP',chainId:'420',blockHash:B,evidenceDigest:E};
   },entitlement:async()=>({accepted:true,chainId:'420',blockHash:B,evidenceDigest:E}),
   attestation:async()=>({accepted:true,chainId:'420',blockHash:B,evidenceDigest:E}),
   missionReward:async()=>({accepted:true,chainId:'420',blockHash:B,evidenceDigest:E}),
   progressionReward:async()=>({accepted:true,chainId:'420',blockHash:B,evidenceDigest:E})};
  const service=createHighCountryScopedFeatures420({authority:auth,
   poolForPrincipal:async({accountId})=>scopes[accountId],canonical});
  assert.equal((await service.read('alpha','ownership',{profileId:F})).kind,'ownership');
  assert.equal((await service.read('alpha','entitlement',{profileId:F,entitlementId:E,
   entitlementType:E,contentId:E})).kind,'entitlement');
  assert.equal((await service.read('alpha','cross-game',{profileId:F,attestationId:E})).accepted,true);
  assert.equal((await service.read('alpha','mission-reward',{profileId:F,missionId:E,amount:'5'})).accepted,true);
  await assert.rejects(service.read('beta','ownership',{profileId:F}),/feature-wallet-not-linked/);
  await assert.rejects(service.read('alpha','ownership',{profileId:F,wallet:W}),/feature-input-invalid/);
  canonical.entitlement=async()=>({accepted:true,chainId:'420',blockHash:E,evidenceDigest:E});
  await assert.rejects(service.read('alpha','entitlement',{profileId:F,entitlementId:E,
   entitlementType:E,contentId:E}),/feature-proof-not-canonical/);
  revoked=true;await assert.rejects(service.read('alpha','ownership',{profileId:F}));
 }finally{for(const p of pools.reverse())try{await p.end();}catch{}}
});
