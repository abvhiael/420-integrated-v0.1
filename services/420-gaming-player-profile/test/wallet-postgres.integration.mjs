import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { generateKeyPairSync,sign,verify } from 'node:crypto';
import { bootstrapDatastoreRoles,migrateDatastore } from '../src/schema-migrations.js';
import { migrateWalletLinks } from '../src/wallet-link-migrations.js';
import { GamingDatastoreProvisioner420 } from '../src/datastore-provisioning.js';
import { PostgresGamingRepository420 } from '../src/postgres-repository.js';
import { createHighCountryWalletService420 } from '../src/wallet-link-service.js';
const uri=process.env.GAMING_WALLET_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r052_ci'))throw Error('isolated r052_ci PostgreSQL required');
const root=new Pool({connectionString:uri}),pools=[root];
const h=x=>'0x'+x.repeat(64),wallet=x=>'0x'+x.repeat(40);
const G=h('1'),R=h('2'),P=h('3'),W=wallet('a'),W2=wallet('b');
const keys=generateKeyPairSync('ed25519');
const tokens=new Map();
let epoch=0;
const clock=()=>Date.now();
function mint(sub,expiry=clock()+300000){
  const data=Buffer.from(JSON.stringify({sub,game:G,epoch,iss:'issuer1',exp:expiry})).toString('base64url');
  return data+'.'+sign(null,Buffer.from(data),keys.privateKey).toString('base64url');
}
const authority={gameId:G,verifyToken(token){
  const [data,sig]=String(token).split('.');
  if(!sig||!verify(null,Buffer.from(data),keys.publicKey,Buffer.from(sig,'base64url')))throw Error('invalid-session');
  const c=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));
  if(c.game!==G||c.iss!=='issuer1'||c.epoch!==epoch||clock()>=c.exp)throw Error('expired-or-revoked-session');
  return c;
},async registeredPrincipal(token){return this.verifyToken(token).sub;}};
async function role(name,account){
  await root.query('CREATE ROLE '+name+" LOGIN PASSWORD 'r052_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO '+name);
  const url=new URL(uri);url.username=name;url.password='r052_only';
  const p=new Pool({connectionString:url.toString(),max:6});pools.push(p);
  await provision.bindRuntimeScope({roleName:name,accountId:account,gameId:G});
  return p;
}
let provision;
test('R05.2 actual PostgreSQL atomic wallet authentication and replay acceptance',async t=>{
 try {
  await bootstrapDatastoreRoles(root);
  await migrateDatastore(root);
  await migrateWalletLinks(root);
  assert.equal((await migrateWalletLinks(root)).changed,false);
  provision=new GamingDatastoreProvisioner420(root);
  for(const a of ['alpha','beta'])
    await provision.provisionAccount({accountId:a,issuerRef:'issuer1',credentialCommitment:h(a==='alpha'?'4':'5')});
  const scope={alpha:await role('r052_alpha','alpha'),beta:await role('r052_beta','beta')};
  for(const [accountId,pool] of Object.entries(scope)) {
    const repo=new PostgresGamingRepository420({pool,accountId,gameId:G,expectedEpoch:'0',expectedIssuerRef:'issuer1'});
    await repo.transaction(tx=>tx.createProfile({profileId:'profile-'+accountId,rulesetId:R}));
  }
  const verified=new Set();
  const client={getChainId:async()=>420,verifyMessage:async ({address,message,signature})=>
    verified.has(signature+'|'+address+'|'+message)};
  const service=createHighCountryWalletService420({authority,poolForPrincipal:async({accountId})=>scope[accountId],
    clientsByChain:new Map([['420',client]]),domain:'hc-example'});
  const a=mint('alpha'),b=mint('beta');
  const input=(address,id)=>({wallet:address,chainId:'420',consentId:id,policyHash:P,consentAccepted:true});
  const signMock=(challenge,signature)=>{verified.add(signature+'|'+challenge.wallet+'|'+challenge.message);return signature;};
  const sig='0x'+'11'.repeat(65);
  await t.test('forged and expired sessions deny challenge before any write',async()=>{
    await assert.rejects(()=>service.issueChallenge(a+'forged',input(W,'bad1')));
    await assert.rejects(()=>service.issueChallenge(mint('alpha',clock()-1),input(W,'bad2')));
  });
  await t.test('invalid signature rejects and leaves unconsumed challenge',async()=>{
    const c=await service.issueChallenge(a,input(W,'first-consent'));
    await assert.rejects(()=>service.completeLink(a,{challengeId:c.challengeId,signature:sig}),/invalid-signature/);
    assert.equal((await service.completeLink(a,{challengeId:c.challengeId,signature:signMock(c,sig)})).wallet,W);
    await assert.rejects(()=>service.completeLink(a,{challengeId:c.challengeId,signature:sig}),/challenge-invalid-or-replayed/);
  });
  await t.test('unique ownership and active profile binding block other accounts',async()=>{
    const c=await service.issueChallenge(b,input(W,'beta-consent'));
    await assert.rejects(()=>service.completeLink(b,{challengeId:c.challengeId,signature:signMock(c,sig)}));
    assert.equal((await service.session(a)).wallet.wallet,W);
    assert.equal((await service.session(b)).wallet,null);
  });
  await t.test('unlink preserves game profile and permanently consumes the prior nonce',async()=>{
    await service.unlink(a);
    assert.equal((await service.session(a)).wallet,null);
    const check=(await scope.alpha.query('SELECT used_at FROM gaming_datastore.wallet_challenges WHERE challenge_id=$1',
      [(await scope.alpha.query('SELECT challenge_id FROM gaming_datastore.wallet_links LIMIT 1')).rows[0].challenge_id])).rows[0];
    assert.ok(check.used_at!==null);
    const c=await service.issueChallenge(a,input(W2,'second-consent'));
    await service.completeLink(a,{challengeId:c.challengeId,signature:signMock(c,sig)});
    assert.equal((await service.session(a)).wallet.wallet,W2);
  });
  await t.test('revoked session fails closed without erasing saved account data',async()=>{
    const c=await service.issueChallenge(a,input(W2,'third-consent'));
    epoch=1;
    await assert.rejects(()=>service.completeLink(a,{challengeId:c.challengeId,signature:signMock(c,sig)}));
    await assert.rejects(()=>service.session(a));
    epoch=0;
    assert.equal((await service.session(a)).wallet.wallet,W2);
  });
  await t.test('recovery rejects absent independent issuer authority',async()=>{
    await assert.rejects(()=>service.issueRecoveryChallenge(a,{...input(W2,'recovery-consent'),recoveryProof:'wallet-only'}),/recovery-disabled/);
  });
 } finally {
  for(const p of pools.reverse())await p.end();
 }
});
