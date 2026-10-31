import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlobalCupProjection420} from '../src/highcountry-global-cup.js';
const hex=(c,n)=>'0x'+c.repeat(n);
const A=hex('a',40),B=hex('b',40),C=hex('c',40),D=hex('d',40);
const cupId=hex('1',64),cupAddress=A,codeHash=hex('2',64);
const record=()=>({
 chainId:420,cupAddress,codeHash,blockHash:hex('3',64),
 finalizedBlock:true,canonical:true,resultsCurrent:true,
 resultCommitment:hex('4',64),rulesHash:hex('5',64),prizeRulesHash:hex('6',64),
 scope:hex('7',64),cupFinalized:true,champion:A,prestigeIssued:true,issuanceCurrent:true,
 rounds:[
  {eventId:hex('8',64),finalized:true,current:true,entrants:[A,B],winner:A,winnerScore:9000},
  {eventId:hex('9',64),finalized:true,current:true,entrants:[C,D],winner:C,winnerScore:9500},
  {eventId:hex('a',64),finalized:true,current:true,entrants:[A,C],winner:A,winnerScore:9800}
 ]
});
function service(x=record()){return createGlobalCupProjection420({
 source:{readFinalizedCup:async () => x},chainId:420,cupAddress,codeHash
});}
test('canonical bracket, provenance, standings, nonfinancial trophy and scoped achievement',async()=>{
 const result=await service().standings({cupId});
 assert.equal(result.champion,A);
 assert.deepEqual(result.rounds.map(x=>x.winner),[A,C,A]);
 assert.equal(result.resultCommitment,hex('4',64));
 assert.equal(result.trophy.financial,false);
 assert.equal(result.trophy.transferable,false);
 assert.equal(result.achievement.scope,hex('7',64));
 assert.equal(result.prizesFunded,false);
});
test('no prestige without confirmed current scoped issuance',async()=>{
 for(const field of ['prestigeIssued','issuanceCurrent']){
  const r=record();r[field]=false;
  assert.equal((await service(r).standings({cupId})).achievement,null);
 }
});
test('fail closed on unfinalized, wrong chain/code, reorg, altered result or fabricated bracket',async()=>{
 for(const [field,value] of [
  ['chainId',1],['cupAddress',B],['codeHash',hex('f',64)],
  ['finalizedBlock',false],['canonical',false],['resultsCurrent',false],
  ['resultCommitment',hex('0',64)],['cupFinalized',false],['champion',B]
 ]){
  const r=record();r[field]=value;
  await assert.rejects(service(r).standings({cupId}),{code:field==='champion'?'cup-bracket-invalid':'cup-not-finalized'},field);
 }
 for(const change of [
  r=>{r.rounds[2].entrants[1]=B},
  r=>{r.rounds[2].entrants[0]=r.rounds[2].entrants[1]},
  r=>{r.rounds[1].winner=A},
  r=>{r.rounds[2].eventId=r.rounds[0].eventId},
  r=>{r.rounds[0].current=false},
  r=>{r.rounds[2].winner=B},
  r=>{r.rounds[0].winnerScore=10001}
 ]){
  const r=record();change(r);
  await assert.rejects(service(r).standings({cupId}),/cup-(round|bracket)-invalid/);
 }
});
test('reject malformed input and unavailable verifier rather than manufacturing records',async()=>{
 assert.throws(()=>createGlobalCupProjection420({}),{code:'cup-config-invalid'});
 await assert.rejects(service().standings({cupId:'not-a-cup'}),{code:'cup-id-invalid'});
 await assert.rejects(service(null).standings({cupId}),{code:'cup-not-finalized'});
 const s=createGlobalCupProjection420({source:{readFinalizedCup:async()=>{throw new Error('rpc unavailable');}},chainId:420,cupAddress,codeHash});
 await assert.rejects(s.standings({cupId}),/rpc unavailable/);
});
