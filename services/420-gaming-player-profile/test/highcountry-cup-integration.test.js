import {keccak256,selector} from '../../../packages/420-gaming-sdk/src/keccak.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighCountryCupRpc420} from '../src/highcountry-cup-rpc.js';
import {createPostgresCupAchievements420} from '../src/highcountry-cup-achievements.js';
const h=(x,n)=>'0x'+x.repeat(n), cup=h('1',64),A=h('a',40),B=h('b',40),C=h('c',40),D=h('d',40);
const S=Object.fromEntries(Object.entries({cups:'cups(bytes32)',finalResultCommitment:'finalResultCommitment(bytes32)',resultsCurrent:'resultsCurrent(bytes32)',isIssued:'isIssued(bytes32,address,bytes32)',events:'events(bytes32)',winners:'winners(bytes32)',winnerScore:'winnerScore(bytes32)',entrantAt:'entrantAt(bytes32,uint256)',resultIsCurrent:'resultIsCurrent(bytes32,address)'}).map(([k,v])=>[k,'0x'+selector(v)]));
const w=x=>BigInt(x).toString(16).padStart(64,'0');
const pack=(...args)=>'0x'+args.map(x=>w(x)).join('');
const sourceCode='0x6001600055',hash=keccak256(Buffer.from('6001600055','hex')),block=h('e',64);
function mockRpc({badChain=false,badCode=false,orphan=false,stale=false,badCommitment=false,badSeason=false}={}){
 const rounds=[h('8',64),h('9',64),h('a',64)];
 const winners=[A,C,A],entrants=[[A,B],[C,D],[A,C]],scores=[9000,9500,9800];
 const requests=[];
 const expectedCommitment=keccak256(Buffer.from([420n,BigInt(A),BigInt(cup),BigInt(h('3',64)),BigInt(h('4',64)),BigInt(h('5',64)),...rounds.map(x=>BigInt(x)),BigInt(A),BigInt(C),BigInt(A),9000n,9500n,9800n].map(w).join(''),'hex'));
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
   else if(selector===S.finalResultCommitment)result=pack(BigInt(badCommitment?h('6',64):expectedCommitment));
   else if(selector===S.resultsCurrent||selector===S.isIssued||selector===S.resultIsCurrent)result=pack(stale?0n:1n);
   else if(selector===S.events)result=pack(BigInt(badSeason&&index===2?h('6',64):h('7',64))),BigInt(h('2',64)),BigInt(A),
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
  cupAddress:A,engineAddress:B,cupCode:sourceCode,engineCode:sourceCode,codeHash:hash,selectors:S,fetchImpl});
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
test('ABI, bytecode and canonical commitment cannot be forged by RPC or deployment config',async()=>{
 for(const options of [{badCommitment:true},{badSeason:true}]){
  const {rpc}=mockRpc(options);
  await assert.rejects(rpc.readFinalizedCup(args),{code:options.badCommitment?'cup-rpc-commitment-mismatch':'cup-rpc-season-mismatch'});
 }
 assert.throws(()=>createHighCountryCupRpc420({endpoint:'https://rpc.example.org',chainId:420,cupAddress:A,engineAddress:B,
  cupCode:sourceCode,engineCode:sourceCode,codeHash:h('f',64),selectors:S}),{code:'cup-rpc-config-invalid'});
 assert.throws(()=>createHighCountryCupRpc420({endpoint:'https://rpc.example.org',chainId:420,cupAddress:A,engineAddress:B,
  cupCode:sourceCode,engineCode:sourceCode,codeHash:hash,selectors:{...S,cups:h('f',8)}}),{code:'cup-rpc-config-invalid'});
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
