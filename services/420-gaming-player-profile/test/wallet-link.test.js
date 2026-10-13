import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHighCountryWalletHttp420,createHighCountryWalletService420 } from '../src/wallet-link-service.js';
import { walletSchemaDigest } from '../src/wallet-link-migrations.js';
import { readFileSync } from 'node:fs';
const h='0x'+'1'.repeat(64),w='0x'+'a'.repeat(40);
test('additive wallet schema pins privacy, proof replay and unique active ownership',()=>{
  const sql=readFileSync(new URL('../migrations/002_wallet_links.up.sql',import.meta.url),'utf8');
  assert.match(sql,/UNIQUE\(game_id,domain,nonce\)/);
  assert.match(sql,/WHERE unlinked_at IS NULL/g);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/g);
  assert.match(sql,/scope_matches\(account_id,game_id\)/g);
  assert.match(sql,/immutable_challenge/);
  assert.match(sql,/immutable_link/);
  assert.match(walletSchemaDigest,/^[0-9a-f]{64}$/);
});
test('HTTP requires Bearer session and denies malformed and oversized bodies',async()=>{
  const server=createHighCountryWalletHttp420({session:async t=>({token:t}),
    issueChallenge:async()=>({}),completeLink:async()=>({}),unlink:async()=>null,
    issueRecoveryChallenge:async()=>({})});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const root='http://127.0.0.1:'+server.address().port;
    const q=(path,options)=>fetch(root+path,options).then(async r=>({status:r.status,json:await r.json()}));
    assert.equal((await q('/v1/session')).status,403);
    assert.equal((await q('/v1/session',{headers:{authorization:'Bearer token'}})).status,200);
    assert.equal((await q('/v1/wallet/challenge',{method:'POST',headers:{authorization:'Bearer token','content-type':'text/plain'},body:'{}'})).status,403);
    assert.equal((await q('/v1/wallet/challenge',{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:'{broken'})).status,403);
    assert.equal((await q('/v1/wallet/challenge',{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({x:'a'.repeat(9000)})})).status,403);
    assert.equal((await q('/v1/admin/disable',{headers:{authorization:'Bearer token'}})).status,404);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('wallet verifier requires pinned canonical chain and rejects unauthenticated inputs',async()=>{
  const authority={gameId:h,verifyToken:t=>{if(t!=='good')throw Error('session denied');return {sub:'account1',game:h,epoch:0,iss:'issuer1'};},
    registeredPrincipal:async t=>{if(t!=='good')throw Error('account revoked');return 'account1';}};
  const store={transaction:async callback=>callback({profile:async()=>({profile_id:'p'}),
    activeWallet:async()=>null})};
  // This is an authorization boundary unit test only: no mock signature is claimed to prove an EVM wallet.
  const pools=new Map([['420',{getChainId:async()=>421,verifyMessage:async()=>true}]]);
  const srv=createHighCountryWalletService420({authority,poolForPrincipal:async()=>({connect(){throw Error('not connected');}}),
    clientsByChain:pools,domain:'highcountry-production'});
  await assert.rejects(()=>srv.issueChallenge('good',{wallet:w,chainId:'420',consentId:'c',policyHash:h,consentAccepted:true}),/chain-mismatch/);
  await assert.rejects(()=>srv.issueChallenge('bad',{wallet:w,chainId:'420',consentId:'c',policyHash:h,consentAccepted:true}),/authentication-denied/);
  await assert.rejects(()=>srv.issueChallenge('good',{wallet:w,chainId:'420',consentId:'c',policyHash:h,consentAccepted:true,admin:true}),/invalid-request/);
  assert.throws(()=>createHighCountryWalletService420({authority,clientsByChain:new Map(),domain:'bad host',poolForPrincipal:()=>{}}),/invalid-configuration/);
});
