// HC-NEXT-7.4 isolated Anvil + real PostgreSQL + authenticated HTTP cross-module acceptance.
// CI must deploy the REAL R04.12/R04.13 Solidity contracts, not mock eth_call replies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {keccak256,selector} from '../../../packages/420-gaming-sdk/src/keccak.js';
import {bootstrapDatastoreRoles} from '../src/schema-migrations.js';
import {migrateCupAchievements420} from '../src/highcountry-cup-migrations.js';
import {createHighCountryCupRuntime420} from '../src/highcountry-cup-runtime.js';
import {createHighCountryCloudHttp420} from '../src/highcountry-cloud-http.js';
const endpoint=process.env.HIGHCOUNTRY_CUP_ANVIL_RPC;
const postgres=process.env.HIGHCOUNTRY_CUP_POSTGRES_TEST_URL;
const cupAddress=process.env.HIGHCOUNTRY_CUP_ANVIL_CUP?.toLowerCase();
const engineAddress=process.env.HIGHCOUNTRY_CUP_ANVIL_ENGINE?.toLowerCase();
const fixtureAddress=process.env.HIGHCOUNTRY_CUP_ANVIL_FIXTURE?.toLowerCase();
const cupId=process.env.HIGHCOUNTRY_CUP_ANVIL_ID;
const account=process.env.HIGHCOUNTRY_CUP_ANVIL_SENDER?.toLowerCase();
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(endpoint||'')||
 !postgres||new URL(postgres).pathname!=='/hc_cup_ci'||!
 [cupAddress,engineAddress,fixtureAddress,account].every(x=>/^0x[0-9a-fA-F]{40}$/.test(x||''))||
 !/^0x[0-9a-fA-F]{64}$/.test(cupId||''))throw Error('isolated-cup-anvil-required');
let rpcId=0;
async function rpc(method,params=[]){
 const id=++rpcId;const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id,method,params})});
 const result=await response.json();
 if(!response.ok||result.error||result.id!==id)throw Error('anvil-rpc:'+JSON.stringify(result.error));
 return result.result;
}
const signatures={cups:'cups(bytes32)',finalResultCommitment:'finalResultCommitment(bytes32)',
 resultsCurrent:'resultsCurrent(bytes32)',isIssued:'isIssued(bytes32,address,bytes32)',
 events:'events(bytes32)',winners:'winners(bytes32)',winnerScore:'winnerScore(bytes32)',
 entrantAt:'entrantAt(bytes32,uint256)',resultIsCurrent:'resultIsCurrent(bytes32,address)'};
const selectors=Object.fromEntries(Object.entries(signatures).map(([k,v])=>[k,'0x'+selector(v)]));
const gameId='0x'+'a'.repeat(64);
test('real EVM→canonical RPC→Cup projection→authenticated HTTP→PostgreSQL and revocation',async()=>{
 const root=new Pool({connectionString:postgres});let pool,server;
 try{
  await bootstrapDatastoreRoles(root);
  await migrateCupAchievements420(root);
  await root.query("CREATE ROLE hc_cup_ci_runtime LOGIN PASSWORD 'test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO hc_cup_ci_runtime');
  const runtimeUrl=new URL(postgres);runtimeUrl.username='hc_cup_ci_runtime';runtimeUrl.password='test-only';
  pool=new Pool({connectionString:runtimeUrl.toString()});
  const finalizedBlock=await rpc('eth_getBlockByNumber',['finalized',false]);
  assert.match(finalizedBlock?.hash||'',/^0x[0-9a-f]{64}$/i);
  const blockRef={blockHash:finalizedBlock.hash,requireCanonical:true};
  const cupCode=await rpc('eth_getCode',[cupAddress,blockRef]);
  const engineCode=await rpc('eth_getCode',[engineAddress,blockRef]);
  const cupLatest=await rpc('eth_getCode',[cupAddress,'latest']);
  const engineLatest=await rpc('eth_getCode',[engineAddress,'latest']);
  assert.match(cupCode,/^0x[0-9a-f]{100,}$/i,'finalized Cup deployment bytecode missing');
  assert.match(engineCode,/^0x[0-9a-f]{100,}$/i,'finalized Engine deployment bytecode missing');
  assert.equal(cupCode.toLowerCase(),cupLatest.toLowerCase(),'Cup finalized/latest bytecode mismatch');
  assert.equal(engineCode.toLowerCase(),engineLatest.toLowerCase(),'Engine finalized/latest bytecode mismatch');
  const codeHash=keccak256(Buffer.from(cupCode.slice(2),'hex'));
  const engineCodeHash=keccak256(Buffer.from(engineCode.slice(2),'hex'));
  assert.match(codeHash,/^0x[0-9a-f]{64}$/i);
  assert.match(engineCodeHash,/^0x[0-9a-f]{64}$/i);
  // These dynamic fixture bytes are isolated-test credentials, not a production code-hash pin.
  // Production requires HTTPS; only this isolated local Anvil test injects a transport
  // which forwards the validated HTTPS configuration to the loopback-only test node.
  const transport=async (_validatedUrl,options)=>fetch(endpoint,options);
  const runtime=createHighCountryCupRuntime420({
   endpoint:'https://cup-anvil.invalid',chainId:420,cupAddress,engineAddress,
   cupCode,engineCode,codeHash,selectors,pool,gameId,fetchImpl:transport});
  const standing=await runtime.standings({cupId});
  assert.equal(standing.rounds.length,3);
  assert.equal(standing.rounds[0].winner.toLowerCase(),standing.rounds[2].winner.toLowerCase());
  assert.equal(standing.rounds[2].winnerScore,9800);
  assert.equal(standing.achievement?.holder.toLowerCase(),standing.champion.toLowerCase());
  assert.equal(standing.prizesFunded,false);
  await runtime.synchronize({cupId});
  await runtime.synchronize({cupId});
  assert.equal((await runtime.historyStatus({cupId})).current,true);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM highcountry_cup.history')).rows[0].n),1);
  const authority={gameId,verifyToken:token=>{if(token!=='valid')throw Error('authentication-denied');
   return {sub:'alice',game:gameId,epoch:0,iss:'issuer-acceptance'};},
   registeredPrincipal:async token=>token==='valid'?'alice':null};
  server=createHighCountryCloudHttp420({authority,
   poolForPrincipal:async()=>pool,provider:{put:async()=>{},get:async()=>{},delete:async()=>{}},
   globalCup:runtime,origin:'https://cup.example.org'});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+'/highcountry/cup/standings';
  const request=(payload,token='valid')=>fetch(url,{method:'POST',headers:{
   authorization:'Bearer '+token,origin:'https://cup.example.org','content-type':'application/json'},
   body:JSON.stringify(payload)});
  assert.equal((await request({cupId,winner:account})).status,400);
  assert.equal((await request({cupId},'invalid')).status,403);
  const good=await request({cupId});assert.equal(good.status,200);
  assert.equal((await good.json()).champion.toLowerCase(),standing.champion.toLowerCase());
  const receipt=await rpc('eth_sendTransaction',[{from:account,to:fixtureAddress,data:'0x'+selector('revokeFinalEvidence()')}]);
  const tx=await rpc('eth_getTransactionReceipt',[receipt]);
  assert.equal(tx.status,'0x1');
  await assert.rejects(runtime.standings({cupId}),/cup-not-finalized/);
  await assert.rejects(runtime.historyStatus({cupId}),/cup-not-finalized/);
  assert.equal((await request({cupId})).status,503);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM highcountry_cup.history')).rows[0].n),1);
 }finally{
  if(server)await new Promise(ok=>server.close(ok));
  if(pool)await pool.end();
  await root.query('DROP SCHEMA IF EXISTS highcountry_cup CASCADE').catch(()=>{});
  await root.query('DROP ROLE IF EXISTS hc_cup_ci_runtime').catch(()=>{});
  await root.end();
 }
});
