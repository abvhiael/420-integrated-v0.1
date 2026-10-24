import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverPlayer,assertCurrentPlayerAction,readCanonicalPlayerState} from './nlhe-player-lifecycle.mjs';
const h=n=>'0x'+n.toString(16).padStart(64,'0'),a=n=>'0x'+n.toString(16).padStart(40,'0');
const expected={chainId:420,engineAddress:a(1),ledgerAddress:a(2),tableId:h(1),player:a(3),blockNumber:25};
const make=()=>({...expected,timestamp:100,seatPlusOne:1,seat:{player:a(3),epoch:2,sittingOut:false},
 lifecycle:{nonce:0,disconnected:false,sitOutNextHand:false,leaveRequested:false},
 eligibleForNextHand:true,signer:a(4),signerEpoch:2,signerSerial:1,
 activeHand:h(2),handId:h(2),settled:false,aborted:false,
 game:{initialized:true,stateRoot:h(3),nonce:0},turn:{seat:0,player:a(3),allowedMoves:13,deadline:160,canTimeout:false}});
const view=s=>recoverPlayer(s,expected);
test('canonical own turn recovers current signer and action guard',()=>{const s=view(make());assert(s.maySubmitAction);assert.equal(s.status,'playing');assert(assertCurrentPlayerAction(s,s));});
test('transport disconnect cannot manufacture timeout or move the clock',()=>{const raw=make(),before=view(raw);raw.lifecycle.disconnected=true;raw.lifecycle.sitOutNextHand=true;raw.lifecycle.nonce=1;const after=view(raw);assert.equal(after.status,'disconnected');assert(!after.maySubmitAction&&!after.mayTimeout);assert.equal(after.guard.deadline,before.guard.deadline);});
test('reconnection with sitting-out intent does not silently join the next hand',()=>{const raw=make();raw.seat.sittingOut=true;raw.lifecycle.sitOutNextHand=true;raw.activeHand=h(0);const s=view(raw);assert.equal(s.status,'sitting-out');assert(!s.eligibleForNextHand&&!s.maySubmitAction);});
test('disconnected all-in remains current public game without a fabricated fold',()=>{const raw=make();raw.lifecycle.disconnected=true;raw.turn.allowedMoves=0;raw.turn.canTimeout=false;const s=view(raw);assert(!s.maySubmitAction&&!s.mayTimeout);assert.equal(raw.game.nonce,0);});
test('queued leave never presents an active hand as withdrawable',()=>{const raw=make();raw.lifecycle.leaveRequested=true;raw.lifecycle.sitOutNextHand=true;assert(!view(raw).mayCompleteLeave);raw.activeHand=h(0);raw.settled=true;const s=view(raw);assert(s.mayCompleteLeave&&!s.maySubmitAction);assert.equal(s.status,'settled');});
test('refunded hand cannot resume a cached betting action',()=>{const raw=make(),old=view(raw);raw.aborted=true;raw.activeHand=h(0);assert.throws(()=>assertCurrentPlayerAction(old,view(raw)),/authorized turn/);});
test('wrong chain, source contracts, table, owner or block fail closed',()=>{for(const field of Object.keys(expected)){const raw=make();raw[field]=typeof raw[field]==='number'?999:field==='player'?a(9):h(9);assert.throws(()=>view(raw));}});
test('seat replacement and key rotation invalidate cached actions',()=>{const old=view(make());for(const change of [s=>s.seat.epoch=3,s=>s.signer=a(5),s=>s.signerSerial=2,s=>s.lifecycle.nonce=1]){const raw=make();change(raw);if(raw.seat.epoch===3)raw.signerEpoch=3;assert.throws(()=>assertCurrentPlayerAction(old,view(raw)),/stale/);}});
test('new root, nonce, hand and deadline invalidate cached actions',()=>{const old=view(make());for(const change of [s=>s.game.stateRoot=h(9),s=>s.game.nonce=1,s=>{s.activeHand=h(9);s.handId=h(9);},s=>s.turn.deadline=159]){const raw=make();change(raw);assert.throws(()=>assertCurrentPlayerAction(old,view(raw)),/stale/);}});
test('expired or another players turn never authorizes reconnect actions',()=>{const raw=make();raw.timestamp=161;assert(!view(raw).maySubmitAction);raw.timestamp=100;raw.turn.player=a(9);assert(!view(raw).maySubmitAction);});
test('invalid seats, conflicting finality, unsafe numbers and nonboolean flags reject',()=>{for(const change of [s=>s.seatPlusOne=10,s=>s.seat.player=a(9),s=>{s.settled=true;s.aborted=true;},s=>s.game.nonce=Number.MAX_SAFE_INTEGER+1,s=>s.lifecycle.disconnected='false']){const raw=make();change(raw);assert.throws(()=>view(raw));}});
test('canonical reader pins hash and detects reconnect reorg',async()=>{const calls=[];const readSnapshot=async block=>{calls.push(block);return make();};let state=await readCanonicalPlayerState({getBlock:async()=>({number:25,hash:h(25)}),readSnapshot,expected});assert(state.state.maySubmitAction);assert.deepEqual(calls,[{blockHash:h(25),requireCanonical:true}]);let n=0;await assert.rejects(readCanonicalPlayerState({getBlock:async()=>({number:25,hash:++n===1?h(25):h(26)}),readSnapshot,expected}),/reorg/);});
