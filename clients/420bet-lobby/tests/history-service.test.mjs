import test from 'node:test';import assert from 'node:assert/strict';
import {createGameHistoryLookup,createGameHistoryHandler} from '../server/history.mjs';
const A='0x'+'a'.repeat(40),G='0x'+'b'.repeat(40),H='0x'+'c'.repeat(64),BLOCK='0x'+'d'.repeat(64);
const config={indexerUrl:'https://indexer.example.test',chainId:420,gameContracts:{dice:[G]}};
function mocked({receiptStatus=1,safeHead='20',blockHash=BLOCK,from=A,gameTo=G,stale=false}={}){
 const requests=[];
 const fetcher=async url=>{const u=new URL(url);requests.push(u.pathname);let data;
 if(u.pathname==='/v1/status')data={chainId:'420',authoritative:false,finality:{safeHead},runtime:{stale}};
 else if(u.pathname==='/v1/transactions')data={items:[{chainId:'420',hash:H,blockNumber:'18',blockHash:BLOCK,from,to:gameTo}]};
 else if(u.pathname==='/v1/transactions/'+H+'/receipt')data={chainId:'420',transactionHash:H,blockNumber:'18',blockHash,status:receiptStatus};
 else if(u.pathname==='/v1/blocks/18')data={chainId:'420',number:'18',hash:BLOCK,timestamp:'1720000000'};
 else throw Error('unexpected indexer request '+u.pathname);
 return {ok:true,json:async()=>({apiVersion:'v1',data})};};
 return {requests,lookup:createGameHistoryLookup({...config,fetcher})};
}
test('canonical indexer evidence yields one game- and chain-scoped confirmed transaction',async()=>{const {requests,lookup}=mocked();const x=await lookup({account:A,requestedChainId:420,gameId:'dice'});assert.equal(x.length,1);assert.deepEqual(x[0],{account:A,chainId:420,gameId:'dice',hash:H,status:'confirmed',game:'dice',timestamp:1720000000});assert(requests.includes('/v1/transactions/'+H+'/receipt'));});
test('failed receipt is not presented as successful',async()=>{const {lookup}=mocked({receiptStatus:0});const x=await lookup({account:A,requestedChainId:420,gameId:'dice'});assert.equal(x[0].status,'failed');});
test('unfinalized, stale, foreign-wallet and wrong-contract records never appear',async()=>{for(const options of [{safeHead:'17'},{from:'0x'+'e'.repeat(40)},{gameTo:'0x'+'e'.repeat(40)}])assert.deepEqual(await mocked(options).lookup({account:A,requestedChainId:420,gameId:'dice'}),[]);await assert.rejects(mocked({stale:true}).lookup({account:A,requestedChainId:420,gameId:'dice'}));});
test('cross-chain, cross-game, invalid addresses and duplicate contract bindings fail closed',async()=>{const {lookup}=mocked();for(const query of [{account:A,requestedChainId:1,gameId:'dice'},{account:A,requestedChainId:420,gameId:'keno'},{account:'oops',requestedChainId:420,gameId:'dice'}])await assert.rejects(lookup(query));assert.throws(()=>createGameHistoryLookup({...config,gameContracts:{dice:[G],keno:[G]}}));});
test('receipt block hash tampering fails closed',async()=>{await assert.rejects(mocked({blockHash:'0x'+'f'.repeat(64)}).lookup({account:A,requestedChainId:420,gameId:'dice'}));});
test('HTTP handler rejects mutation and exposes only qualified read-only data',async()=>{const handler=createGameHistoryHandler(mocked().lookup);async function request(method,url){const response={writeHead(status,headers){this.status=status;this.headers=headers},end(text){this.body=JSON.parse(text)}};await handler({method,url},response);return response;}const post=await request('POST','/api/420bet/player-history');assert.equal(post.status,405);const result=await request('GET','/api/420bet/player-history?account='+A+'&chainId=420&gameId=dice');assert.equal(result.status,200);assert.equal(result.body[0].gameId,'dice');assert.equal(result.headers['Cache-Control'],'no-store');});
