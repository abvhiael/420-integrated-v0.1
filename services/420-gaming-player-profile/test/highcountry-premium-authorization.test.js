import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryPremiumAuthorization420} from '../src/highcountry-premium-authorization.js';
const H='0x'+'1'.repeat(64), S='0x'+'2'.repeat(64), R='0x'+'3'.repeat(40),W='0x'+'4'.repeat(40);
function fixture(){
 let linked={wallet:W,chain_id:'420'},revoked=false,confirmed=12,allowed=true,chainId='420',reads=[];
 const walletService={session:async token=>{
  if(token!=='issuer-valid'||revoked)throw Error('authentication-denied');
  return {accountId:'registered-user',gameId:H,wallet:linked};
 }};
 const chain={
  getChainId:async()=>chainId,
  getFinalizedBlock:async()=>({number:100,confirmations:confirmed,hash:H}),
  readGate:async args=>{reads.push(args);return allowed;}
 };
 const auth=createHighCountryPremiumAuthorization420({walletService,chain,gameId:H,
  networkId:'420',registryAddress:R});
 return {auth,reads,setLink:v=>linked=v,revoke:()=>revoked=true,setConfirmations:v=>confirmed=v,
  setAllowed:v=>allowed=v,setChain:v=>chainId=v,chain};
}
test('issuer-verified account and established durable wallet link permit only independent finalized scope',async()=>{
 const x=fixture();
 const result=await x.auth.eligible({token:'issuer-valid',scopeId:S});
 assert.equal(result.accountId,'registered-user');
 assert.equal(result.wallet,W.toLowerCase());
 assert.deepEqual(x.reads,[{registryAddress:R,account:W,scope:S,blockHash:H,requireCanonical:true}]);
});
test('guest, unlinked, wrong chain, unknown scope, insufficient finality and revoked entitlement fail closed',async()=>{
 const x=fixture();
 await assert.rejects(x.auth.eligible({token:'guest',scopeId:S}),/authentication-denied/);
 await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:'0x'+'0'.repeat(64)}),/premium-scope-invalid/);
 x.setLink(null);await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-link-required/);
 x.setLink({wallet:W,chain_id:'421'});await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-link-required/);
 x.setLink({wallet:W,chain_id:'420'});x.setChain('421');
 await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-chain-mismatch/);
 x.setChain('420');x.setConfirmations(2);
 await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-finality-unavailable/);
 x.setConfirmations(12);x.setAllowed(false);
 await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-ineligible/);
 x.revoke();await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/authentication-denied/);
});
test('unlink or relink during canonical RPC query cannot authorize stale account',async()=>{
 const x=fixture();
 x.chain.readGate=async()=>{x.setLink(null);return true;};
 await assert.rejects(x.auth.eligible({token:'issuer-valid',scopeId:S}),/premium-link-revoked/);
});
test('rejects unsafe or unconfigured verification providers',()=>{
 assert.throws(()=>createHighCountryPremiumAuthorization420(),/premium-configuration-invalid/);
});
