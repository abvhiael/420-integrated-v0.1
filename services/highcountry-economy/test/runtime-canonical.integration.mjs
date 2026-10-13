// Actual disposable Anvil + PostgreSQL journey. Public development wallets only; no live credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import pg from 'pg';
import {FinalizedRpc,calldata,word} from '../src/finalized-rpc.js';
import {keccak256} from '../src/keccak.js';
import {createRuntime,runtimeHttpServer} from '../src/runtime-service.js';
const admin=new pg.Pool({connectionString:process.env.HC_TEST_POSTGRES_URL});
const rpcUrl=process.env.HC_TEST_RPC_URL||'http://127.0.0.1:8545';
const chain=new FinalizedRpc({url:rpcUrl,chainId:420,contracts:{}});
const accounts=await chain.request('eth_accounts',[]),operator=accounts[0].toLowerCase(),seller=accounts[1].toLowerCase(),buyer=accounts[2].toLowerCase();
async function receipt(hash){
 for(let i=0;i<100;i++){
  const r=await chain.request('eth_getTransactionReceipt',[hash]);if(r){
   if(r.status!=='0x1'){
    const trace=await chain.request('debug_traceTransaction',[hash,{disableStorage:true,disableMemory:true,disableStack:true}]);
    console.log(JSON.stringify({deploymentFailure:Object.fromEntries(Object.entries(trace).map(([k,v])=>[k,Array.isArray(v)?{length:v.length,last:v.slice(-3)}:v])),receipt:r}));
   }
   assert.equal(r.status,'0x1');return r;}

  await new Promise(r=>setTimeout(r,100));
 }throw Error('receipt timeout');
}
async function send(from,to,data){
 const r=await receipt(await chain.request('eth_sendTransaction',[{from,to,data,gas:'0xbebc200'}]));
 await chain.request('anvil_mine',['0x40']);return r;
}
const artifact=JSON.parse(await readFile(new URL('../../../contracts/out/R04RuntimeDeployment.sol/R04RuntimeDeployment.json',import.meta.url),'utf8'));
const deployed=await send(operator,undefined,artifact.bytecode.object+word(operator));
const fixture=deployed.contractAddress;
async function readGetter(name){return chain.request('eth_call',[{to:fixture,data:calldata(name+'()')},'latest']);}
const addresses={};
for(const name of ['games','identity','mission','emergency','inventory','escrow'])addresses[name]='0x'+(await readGetter(name)).slice(-40);
const game=await readGetter('GAME'),objective=await readGetter('MISSION'),asset=await readGetter('RESOURCE');
for(const wallet of [seller,buyer])await send(wallet,addresses.identity,calldata('createProfile(bytes32,bytes32)',game,keccak256(Buffer.from(wallet))));
await send(buyer,addresses.mission,calldata('activate(bytes32)',objective));
await send(operator,fixture,calldata('verifyTestMission(address)',buyer));
await send(buyer,addresses.mission,calldata('claim(bytes32)',objective));
await send(operator,fixture,calldata('mintTestResource(address)',seller));
await send(seller,addresses.inventory,calldata('setInventoryOperator(address,bool)',addresses.escrow,1));
await send(seller,addresses.inventory,calldata('setMarketTransferOperator(address,bool)',addresses.escrow,1));
const listing=keccak256(Buffer.from('runtime-listing')),expires=Math.floor(Date.now()/1000)+3600;
await send(seller,addresses.escrow,calldata('list(bytes32,bytes32,uint256,uint64)',listing,asset,3,expires));
const contracts={};
for(const name of ['games','identity','mission','emergency','escrow']){
 const code=await chain.request('eth_getCode',[addresses[name],'latest']);
 contracts[name]={address:addresses[name],codeHash:keccak256(Buffer.from(code.slice(2),'hex'))};
}
const role='hc_runtime_chain_'+process.pid,sessionKeys=generateKeyPairSync('ed25519'),proofKeys=generateKeyPairSync('ed25519');
const databaseUrl=new URL(process.env.HC_TEST_POSTGRES_URL);databaseUrl.username=role;databaseUrl.password='hc_ci_runtime_only';
let pool,server;
try {
 await admin.query(await readFile(new URL('../migrations/001_buds_state.sql',import.meta.url),'utf8'));
 await admin.query(await readFile(new URL('../migrations/002_runtime_namespace_rls.sql',import.meta.url),'utf8'));
 await admin.query('CREATE ROLE '+role+" LOGIN PASSWORD 'hc_ci_runtime_only'");
 await admin.query('GRANT USAGE ON SCHEMA public TO '+role);await admin.query('GRANT SELECT,UPDATE ON highcountry_buds_state TO '+role);
 const empty={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],assets:[],assetSources:[],listings:[],transferIntents:[],importedAssets:[],issued:0,burned:0};
 await admin.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[role,JSON.stringify(empty)]);
 pool=new pg.Pool({connectionString:databaseUrl.toString()});
 const config={pool,namespace:role,authority:{issuers:{idp:{publicKey:sessionKeys.publicKey,operators:{operator:{sources:['inventory'],marketOperator:true}}}},
  audience:'hc-local-ci',gameId:game,chainId:420,origin:'http://hc.local-ci'},
  rpc:{url:rpcUrl,chainId:420,contracts},
  sources:{mission:{kind:'mission',contract:addresses.mission,publicKey:proofKeys.publicKey,epoch:0,maxAward:100,totalCap:200,
   emergencyDomain:keccak256(Buffer.from('HC.EMERGENCY.MISSION_ACTIVATION'))}},
  marketDomain:keccak256(Buffer.from('HC.EMERGENCY.MARKET')),operator,issuer:operator,signerRpc:chain};
 const runtime=await createRuntime(config);
 server=runtimeHttpServer(runtime,{origin:'http://hc.local-ci'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const token=sub=>{const now=Date.now(),payload=Buffer.from(JSON.stringify({iss:'idp',sub,sid:'ci-'+sub,aud:'hc-local-ci',game,nbf:now-1000,exp:now+600000,epoch:0})).toString('base64url');
  return payload+'.'+sign(null,Buffer.from(payload),sessionKeys.privateKey).toString('base64url');};
 const tokens={seller:token('seller'),buyer:token('buyer'),operator:token('operator')};
 async function post(who,path,data={},expect=200){
  const r=await fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+tokens[who],'content-type':'application/json',origin:'http://hc.local-ci'},body:JSON.stringify(data)});
  const body=await r.json();assert.equal(r.status,expect,JSON.stringify(body));return body.result;
 }
 for(const who of Object.keys(tokens))await post(who,'/accounts/register');
 for(const [who,wallet] of [['seller',seller],['buyer',buyer]]){
  const c=await post(who,'/wallet/challenge',{wallet});
  const signature=await chain.request('personal_sign',['0x'+Buffer.from(c.message).toString('hex'),wallet]);
  await post(who,'/wallet/link',{nonce:c.nonce,signature});
  await post(who,'/wallet/link',{nonce:c.nonce,signature},403);
 }
 const payload=Buffer.from(JSON.stringify({domain:'HC.GAMEPLAY.REWARD.V1',game,chainId:420,owner:'buyer',wallet:buyer,
  source:'mission',contract:addresses.mission,objective,amount:100,expires:Date.now()+60000,epoch:0})).toString('base64url');
 const proof={payload,signature:sign(null,Buffer.from(payload),proofKeys.privateKey).toString('base64url')};
 await post('buyer','/rewards/claim',{source:'mission',proof});await post('buyer','/rewards/claim',{source:'mission',proof},403);
 const lock=await runtime.reader.lockedEscrowReceipt(listing,1);assert.ok(lock);
 await post('buyer','/market/import',{operation:'wrong-issuer',receipt:{...lock,owner:'seller'}},403);
 await post('operator','/market/import',{operation:'canonical-import',receipt:{...lock,owner:'seller'}});
 await post('seller','/market/list',{operation:'canonical-list',listing,asset,quantity:3,price:20,expiresAt:expires*1000});
 const op=await runtime.authority.expectedTransferOperation(listing,'buyer');
 await post('buyer','/market/prepare',{operation:'prepare',listing,transferOperation:op});
 await send(operator,addresses.emergency,calldata('setRestricted(bytes32,bool)',config.marketDomain,1));
 await post('operator','/operator/reconcile',{transferOperation:op},403);
 await send(operator,addresses.emergency,calldata('setRestricted(bytes32,bool)',config.marketDomain,0));
 const submitted=await post('operator','/operator/reconcile',{transferOperation:op});assert.equal(submitted.status,'submitted');
 await receipt(submitted.txHash);await chain.request('anvil_mine',['0x40']);
 // A newly constructed worker/service instance reconciles the persisted intent and finalized canonical receipt.
 const restarted=await createRuntime(config);const settled=await restarted.worker.tick(op);assert.equal(settled.status,'finalized');
 const balances=await restarted.store.transact(s=>({buyer:s.balances.get('buyer'),seller:s.balances.get('seller'),intent:s.transferIntents.get(op),issued:s.issued}));
 assert.equal(balances.buyer.available,80);assert.equal(balances.buyer.reserved,0);assert.equal(balances.seller.available,20);
 assert.equal(balances.issued,100);assert.equal(balances.intent.status,'finalized');
 assert.equal((await restarted.worker.tick(op)).status,'resolved');
 console.log('Actual Anvil/PostgreSQL HTTP session -> EOA consent -> canonical identity -> claimed mission -> BUDS -> owner-authorized escrow -> signed worker -> finalized receipt -> restart settlement: PASS');
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();
 try{await admin.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[role]);await admin.query('DROP OWNED BY '+role);await admin.query('DROP ROLE '+role);}catch{}
 await admin.end();
}
