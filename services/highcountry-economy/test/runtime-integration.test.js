import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
import {RuntimeAuthority,GameplayRewardRuntime} from '../src/runtime-integration.js';
import {FinalizedRpc,calldata} from '../src/finalized-rpc.js';
import {keccak256,selector} from '../src/keccak.js';
import {runtimeHttpServer} from '../src/runtime-service.js';
const game='0x'+'11'.repeat(32),wallet='0x'+'22'.repeat(20),contract='0x'+'33'.repeat(20);
const objective='0x'+'44'.repeat(32),domain='0x'+'55'.repeat(32);
function fixture(){
 const sessionKeys=generateKeyPairSync('ed25519'),sourceKeys=generateKeyPairSync('ed25519');
 const store=new MemoryTransactionFixture();let now=10000,canonical=true,consent=true,open=true;
 const rpc={playerProfile:async()=>{if(!canonical)throw Error('reorg');return '0x'+'66'.repeat(32);},
  verifyWallet:async(_w,_m,s)=>consent&&s==='signed',unrestricted:async()=>open,
  missionReward:async(_s,w,_id,n)=>canonical&&w===wallet&&n===7};
 const authority=new RuntimeAuthority({store,issuers:{idp:{publicKey:sessionKeys.publicKey,operators:{alice:{administrator:true}}}},
  audience:'hc',gameId:game,chainId:420,origin:'https://highcountry.example',rpc,sourcePolicies:{mission:{epoch:0}},clock:()=>now});
 const token=(changes={})=>{const p=Buffer.from(JSON.stringify({iss:'idp',sub:'alice',sid:'session1',aud:'hc',game,nbf:0,exp:100000,epoch:0,...changes})).toString('base64url');
  return p+'.'+sign(null,Buffer.from(p),sessionKeys.privateKey).toString('base64url');};
 const proof=(changes={})=>{const payload=Buffer.from(JSON.stringify({domain:'HC.GAMEPLAY.REWARD.V1',game,chainId:420,
  owner:'alice',wallet,source:'mission',contract,objective,amount:7,expires:50000,epoch:0,...changes})).toString('base64url');
  return {payload,signature:sign(null,Buffer.from(payload),sourceKeys.privateKey).toString('base64url')};};
 const rewards=new GameplayRewardRuntime({store,authority,rpc,sources:{mission:{kind:'mission',contract,
  publicKey:sourceKeys.publicKey,epoch:0,maxAward:7,totalCap:14,emergencyDomain:domain}},clock:()=>now});
 const link=async()=>{await authority.register(token());const c=await authority.linkChallenge(token(),wallet);await authority.linkWallet(token(),c.nonce,'signed');return c;};
 return {store,authority,rewards,token,proof,link,rpc,setCanonical:v=>canonical=v,setConsent:v=>consent=v,
  setOpen:v=>open=v,setNow:v=>now=v};
}
test('Ethereum hash/ABI vectors use Keccak rather than SHA3',()=>{
 assert.equal(keccak256(Buffer.alloc(0)),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
 assert.equal(selector('transfer(address,uint256)'),'a9059cbb');
 assert.equal(calldata('mission(address,bytes32)',wallet,objective).length,138);
});
test('signed session scope expiry forgery registration and revocation',async()=>{
 const f=fixture();await assert.rejects(f.authority.registeredPrincipal(f.token()),/unregistered/);
 await f.authority.register(f.token());assert.equal(await f.authority.registeredPrincipal(f.token()),'alice');
 await assert.rejects(f.authority.register(f.token({aud:'other'})),/denied/);
 await assert.rejects(f.authority.register(f.token({game:'other'})),/denied/);
 await assert.rejects(f.authority.register(f.token({exp:10000})),/denied/);
 const token=f.token();await assert.rejects(f.authority.register(token.slice(0,-5)+'AAAAA'),/denied/);
 await f.authority.revoke(token,'alice');await assert.rejects(f.authority.registeredPrincipal(token),/revoked/);
});
test('wallet consent nonce is durable one-use scoped and unlink preserves internal account',async()=>{
 const f=fixture();await f.authority.register(f.token());const c=await f.authority.linkChallenge(f.token(),wallet);
 f.setConsent(false);await assert.rejects(f.authority.linkWallet(f.token(),c.nonce,'signed'),/consent/);
 f.setConsent(true);await f.authority.linkWallet(f.token(),c.nonce,'signed');
 await assert.rejects(f.authority.linkWallet(f.token(),c.nonce,'signed'),/challenge/);
 const restarted=new RuntimeAuthority({...f.authority,store:f.store});
 assert.equal(await restarted.walletOf(f.token()),wallet);
 await restarted.unlink(f.token());await assert.rejects(restarted.walletOf(f.token()),/binding/);
 assert.equal(await restarted.registeredPrincipal(f.token()),'alice');
});
test('canonical mission reward credits actual BUDS once with source and account binding',async()=>{
 const f=fixture();await f.link();
 await f.rewards.claim(f.token(),'mission',f.proof());assert.equal(f.store.state.balances.get('alice').available,7);
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof({expires:55000})),/replayed/);
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof({owner:'bob'})),/denied/);
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof({amount:70})),/completion/);
 assert.equal(f.store.state.issued,7);
});
test('reorg source revocation emergency and forged gameplay proofs never issue rewards',async()=>{
 const f=fixture();await f.link();f.setOpen(false);
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof()),/restricted/);f.setOpen(true);
 const bad=f.proof();bad.signature=bad.signature.slice(0,-5)+'AAAAA';
 await assert.rejects(f.rewards.claim(f.token(),'mission',bad),/denied/);
 await f.store.transact(s=>s.runtimeSourceEpochs.set('mission',1));
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof()),/revoked/);
 f.setCanonical(false);await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof()),/reorg/);
 assert.equal(f.store.state.issued,0);
});
test('canonical RPC binds chain code hash and EIP1898 block hash; reorg and wrong chain deny',async()=>{
 let wrong=false,reorg=false;
 const hash='0x'+'aa'.repeat(32),other='0x'+'bb'.repeat(32),calls=[];
 const rpc=new FinalizedRpc({url:'http://localhost',chainId:420,contracts:{x:{address:contract,codeHash:keccak256(Buffer.from('6000','hex'))}},
  fetchImpl:async(_url,request)=>{const q=JSON.parse(request.body);calls.push(q);
   const result=q.method==='eth_chainId'?(wrong?'0x1':'0x1a4'):q.method==='eth_getCode'?'0x6000':
    q.method==='eth_call'?'0x'+'00'.repeat(32):{number:'0x10',hash:reorg&&q.params[0]!=='finalized'?other:hash};
   return {ok:true,json:async()=>({id:q.id,result})};}});
 await rpc.call('x','0x12345678');
 assert.deepEqual(calls.find(x=>x.method==='eth_call').params[1],{blockHash:hash,requireCanonical:true});
 reorg=true;await assert.rejects(rpc.call('x','0x12345678'),/anchor/);reorg=false;wrong=true;
 await assert.rejects(rpc.call('x','0x12345678'),/wrong chain/);
});
test('HTTP routes require signed bearer session, bound origin and deny unknown or privileged routes',async t=>{
 const f=fixture();const server=runtimeHttpServer({identity:f.authority,rewards:f.rewards},{origin:'https://highcountry.example'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port;
 const post=async(path,headers={})=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:'{}'});
 assert.equal((await post('/accounts/register')).status,403);
 assert.equal((await post('/accounts/register',{authorization:'Bearer '+f.token()})).status,200);
 assert.equal((await post('/accounts/register',{authorization:'Bearer '+f.token(),origin:'https://evil.example'})).status,403);
 assert.equal((await post('/operator/reconcile',{authorization:'Bearer '+f.token()})).status,403);
 assert.equal((await post('/unknown',{authorization:'Bearer '+f.token()})).status,403);
});

test('source revocation advances nonzero configured epochs without allowing old proofs',async()=>{
 const f=fixture();await f.link();
 f.authority.sourcePolicies.mission.epoch=5;f.rewards.sources.mission.epoch=5;
 await f.authority.revokeSource(f.token(),'mission');
 assert.equal(f.store.state.runtimeSourceEpochs.get('mission'),6);
 await assert.rejects(f.rewards.claim(f.token(),'mission',f.proof({epoch:5})),/revoked/);
 assert.equal(f.store.state.issued,0);
});
