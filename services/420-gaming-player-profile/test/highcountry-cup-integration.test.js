import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCupRpc420} from '../src/highcountry-cup-rpc.js';
import {createPostgresCupAchievements420} from '../src/highcountry-cup-achievements.js';
const h=(x,n)=>'0x'+x.repeat(n), cup=h('1',64),A=h('a',40),B=h('b',40),C=h('c',40),D=h('d',40);
const S={cups:h('1',8),resultCommitment:h('2',8),resultsCurrent:h('3',8),isIssued:h('4',8),
events:h('5',8),winners:h('6',8),winnerScore:h('7',8),entrantAt:h('8',8),resultIsCurrent:h('9',8)};
const w=x=>BigInt(x).toString(16).padStart(64,'0');
const pack=(...args)=>'0x'+args.map(x=>w(x)).join('');
const sourceCode='0x6001600055',hash=h('f',64),block=h('e',64);
function mockRpc({badChain=false,badCode=false,orphan=false,stale=false}={}){
 const rounds=[h('8',64),h('9',64),h('a',64)];
 const winners=[A,C,A],entrants=[[A,B],[C,D],[A,C]],scores=[9000,9500,9800];
 const requests=[];
 const fetchImpl=async(_url,opts)=>{
  const req=JSON.parse(opts.body);requests.push(req);
  let result;
  const [arg1,arg2]=req.params;
  if(req.method==='eth_chainId')result=badChain?'0x1':'0x1a4';
  else if(req.method==='eth_getBlockByNumber')result={hash:block,number:'0xa'};
  else if(req.method==='eth_getBlockByHash')result=orphan?null:{hash:block,number:'0xa'};
  else if(req.method==='eth_getCode')result=badCode?'0x6000':sourceCode;
  else if(req.method==='eth_call'){
   const selector=arg1.data.slice(0,10),a0='0x'+arg1.data.slice(10,74);
   const index=rounds.findIndex(x=>x===a0);
   if(selector===S.cups)result=pack(BigInt(A),BigInt(rounds[0]),BigInt(rounds[1]),BigInt(rounds[2]),
     BigInt(h('3',64)),BigInt(h('4',64)),BigInt(h('5',64)),1n,BigInt(A));
   else if(selector===S.resultCommitment)result=pack(BigInt(h('6',64)));
   else if(selector===S.resultsCurrent||selector===S.isIssued||selector===S.resultIsCurrent)result=pack(stale?0n:1n);
   else if(selector===S.events)result=pack(BigInt(h('7',64)),BigInt(h('2',64)),BigInt(A),
     1n,2n,3n,2n,1n,0n);
   else if(selector===S.winners)result=pack(BigInt(winners[index]));
   else if(selector===S.winnerScore)result=pack(BigInt(scores[index]));
   else if(selector===S.entrantAt){
    const i=Number(BigInt('0x'+arg1.data.slice(74,138)));
    result=pack(BigInt(entrants[index][i]));
   }else throw Error('unexpected selector: '+selector);
  }else throw Error('unexpected method');
  return {ok:true,json:async()=>({jsonrpc:'2.0',id:req.id,result})};
 };
 const rpc=createHighCountryCupRpc420({endpoint:'https://rpc.example.org',chainId:420,
  cupAddress:A,engineAddress:B,cupCode:sourceCode,engineCode:sourceCode,selectors:S,fetchImpl});
 return {rpc,requests};
}
const args={cupId:cup,chainId:420,cupAddress:A,codeHash:hash};
test('finalized EIP-1898 Cup/engine reads produce authoritative bracket and provenance',async()=>{
 const {rpc,requests}=mockRpc(),r=await rpc.readFinalizedCup(args);
 assert.equal(r.champion,A);assert.equal(r.rounds.length,3);
 assert.deepEqual(r.rounds.map(x=>x.winner),[A,C,A]);assert.equal(r.prestigeIssued,true);
 assert(requests.filter(x=>x.method==='eth_call').every(x=>x.params[1].blockHash===block&&x.params[1].requireCanonical===true));
});
test('chain, bytecode, orphan block and result revocation are not promoted into valid awards',async()=>{
 for(const [field,code] of [['badChain','cup-rpc-chain-mismatch'],['badCode','cup-rpc-code-mismatch'],['orphan','cup-rpc-finality-unavailable']]){
  const {rpc}=mockRpc({[field]:true});await assert.rejects(rpc.readFinalizedCup(args),{code});
 }
 const {rpc}=mockRpc({stale:true});
 assert.equal((await rpc.readFinalizedCup(args)).resultsCurrent,false);
});
test('invalid configuration, untrusted ID, unavailable RPC fail closed',async()=>{
 assert.throws(()=>createHighCountryCupRpc420({}),{code:'cup-rpc-config-invalid'});
 const {rpc}=mockRpc();
 await assert.rejects(rpc.readFinalizedCup({...args,cupId:'fake'}),{code:'cup-rpc-invalid-input'});
});
test('durable achievement writes are idempotent and revalidate source before reading',async()=>{
 const operations=[];let stored=null;
 const standings={cupId:cup,chainId:420,cupAddress:A,blockHash:block,champion:A,
  resultCommitment:h('6',64),scope:h('5',64),achievement:{kind:'prestige'}};
 let canonical=standings;
 const pool={connect:async()=>({
  query:async(sql,args=[])=>{
   operations.push(sql);
   if(sql.includes('INSERT INTO highcountry_cup.achievements'))stored={block_hash:args[4],commitment:args[6],champion:args[5],prestige:args[8]};
   if(sql.includes('SELECT * FROM highcountry_cup.achievements'))return {rows:stored?[stored]:[]};
   return {rows:[]};
  },release(){}
 })};
 const ledger=createPostgresCupAchievements420({pool,gameId:h('f',64),projection:{standings:async()=>canonical}});
 await ledger.synchronize({cupId:cup});await ledger.synchronize({cupId:cup});
 assert.equal((await ledger.current({cupId:cup})).current,true);
 canonical={...canonical,blockHash:h('d',64)};
 assert.equal((await ledger.current({cupId:cup})).current,false);
 assert.equal(operations.filter(x=>x.includes('INSERT INTO highcountry_cup.history')).length,2);
});

test('SERIALIZABLE conflicts retry entire transaction with fresh canonical witness and rollback',async()=>{
 let attempts=0,rollbacks=0,reads=0,commits=0;
 const pool={connect:async()=>{attempts++;return {
  query:async sql=>{
   if(sql==='ROLLBACK'){rollbacks++;return {rows:[]};}
   if(sql==='COMMIT'){commits++;if(attempts===1)throw Object.assign(Error('serialization'),{code:'40001'});}
   return {rows:[]};
  },release(){}
 };}};
 const store=createPostgresCupAchievements420({pool,gameId:h('f',64),
  projection:{standings:async()=>{reads++;return {cupId:cup,chainId:420,cupAddress:A,
    blockHash:h('1',64),champion:A,resultCommitment:h('2',64),scope:h('3',64),achievement:null};}}});
 await store.synchronize({cupId:cup});
 assert.equal(attempts,2);assert.equal(rollbacks,1);assert.equal(commits,2);
 assert.equal(reads,2,'do not reuse stale chain witness on retry');
});
test('bounded retry exhausts after three failures and does not retry unrelated errors',async()=>{
 for(const [errorCode,expected,limit] of [['40P01','cup-retry-required',3],['23505','duplicate',1]]){
  let attempts=0,rollbacks=0;
  const pool={connect:async()=>{attempts++;return {
   query:async sql=>{if(sql==='ROLLBACK'){rollbacks++;return {rows:[]};}
    if(sql.startsWith('INSERT INTO highcountry_cup.achievements'))
     throw Object.assign(Error(expected==='duplicate'?expected:'transient'),{code:errorCode});
    return {rows:[]};},release(){}
  };}};
  const store=createPostgresCupAchievements420({pool,gameId:h('f',64),
   projection:{standings:async()=>({cupId:cup,chainId:420,cupAddress:A,blockHash:block,
    champion:A,resultCommitment:h('6',64),scope:h('5',64),achievement:null})}});
  await assert.rejects(store.synchronize({cupId:cup}),e=>expected==='duplicate'?e.code===errorCode:e.code===expected);
  assert.equal(attempts,limit);assert.equal(rollbacks,limit);
 }
});
