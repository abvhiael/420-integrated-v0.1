import assert from 'node:assert/strict';

const ZERO='0x'+'0'.repeat(64),NOBODY='0x'+'0'.repeat(40);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const uint=x=>{assert(typeof x==='bigint'||typeof x==='string'||Number.isSafeInteger(x),'unsafe integer');const n=BigInt(x);assert(n>=0n,'negative integer');return n;};
const boolean=x=>{assert(typeof x==='boolean','invalid boolean');return x;};

/// Public projection of a decoded PokerPlayerRecovery420 snapshot. The caller
/// pins deployed addresses and a canonical block; a websocket is never authority.
export function recoverPlayer(s,expected){
 for(const n of [s.timestamp,s.seat.epoch,s.lifecycle.nonce,s.signerEpoch,s.signerSerial,s.game.nonce,s.turn.seat,s.turn.allowedMoves,s.turn.deadline])uint(n);
 for(const flag of [s.lifecycle.disconnected,s.lifecycle.sitOutNextHand,s.lifecycle.leaveRequested,s.seat.sittingOut,s.eligibleForNextHand,s.game.initialized,s.turn.canTimeout])boolean(flag);
 for(const name of ['engineAddress','ledgerAddress','tableId','player'])
  assert(same(s[name],expected[name]),'reconnect context mismatch: '+name);
 assert(uint(s.chainId)===uint(expected.chainId),'wrong chain');
 assert(uint(s.blockNumber)===uint(expected.blockNumber),'wrong block');
 const plus=uint(s.seatPlusOne);assert(plus<=9n,'invalid seat');
 const seated=plus!==0n;
 if(seated)assert(same(s.seat.player,s.player)&&uint(s.seat.epoch)>0n,'wrong seat owner');
 const disconnected=boolean(s.lifecycle.disconnected),leaving=boolean(s.lifecycle.leaveRequested);
 const sitOut=boolean(s.seat.sittingOut)||boolean(s.lifecycle.sitOutNextHand);
 const settled=boolean(s.settled),aborted=boolean(s.aborted);
 assert(!(settled&&aborted),'conflicting terminal state');
 const active=!same(s.activeHand,ZERO),initialized=boolean(s.game.initialized);
 const current=active&&same(s.activeHand,s.handId)&&initialized&&!settled&&!aborted;
 const signerCurrent=seated&&!same(s.signer,NOBODY)&&uint(s.signerEpoch)===uint(s.seat.epoch)&&uint(s.signerSerial)>0n;
 const ownTurn=current&&seated&&uint(s.turn.seat)===plus-1n&&same(s.turn.player,s.player);
 const maySubmitAction=ownTurn&&signerCurrent&&!disconnected&&uint(s.turn.allowedMoves)>0n&&uint(s.timestamp)<=uint(s.turn.deadline);
 return Object.freeze({
  status:settled?'settled':aborted?'refunded':!seated?'not-seated':leaving?'leaving':disconnected?'disconnected':sitOut?'sitting-out':current?'playing':active?'awaiting-proofs':'seated',
  maySubmitAction,mayTimeout:current&&boolean(s.turn.canTimeout),
  mayCompleteLeave:seated&&leaving&&!active,
  eligibleForNextHand:seated&&boolean(s.eligibleForNextHand)&&!leaving&&!disconnected&&!sitOut,
  // Compare these before signing or resubmitting any cached action/intent.
  guard:Object.freeze({chainId:String(s.chainId),engineAddress:s.engineAddress.toLowerCase(),ledgerAddress:s.ledgerAddress.toLowerCase(),
   tableId:s.tableId.toLowerCase(),player:s.player.toLowerCase(),seatEpoch:seated?String(s.seat.epoch):'0',
   lifecycleNonce:String(s.lifecycle.nonce),signer:s.signer.toLowerCase(),signerSerial:String(s.signerSerial),
   activeHand:s.activeHand.toLowerCase(),handId:s.handId.toLowerCase(),stateRoot:s.game.stateRoot.toLowerCase(),
   actionNonce:String(s.game.nonce),deadline:String(s.turn.deadline)})
 });
}

export function assertCurrentPlayerAction(previous,current){
 assert(current.maySubmitAction,'no current authorized turn');
 assert.deepEqual(previous.guard,current.guard,'cached action belongs to stale player/hand/session state');
 return true;
}

/// Adapters must use eth_call at the supplied block hash (EIP-1898,
/// requireCanonical=true), or an equivalent verified canonical block read.
/// Recheck the anchor before publishing recovered state. Never retry a write.
export async function readCanonicalPlayerState({getBlock,readSnapshot,expected,blockTag='finalized'}){
 const block=await getBlock(blockTag);
 assert(block&&/^0x[0-9a-f]{64}$/i.test(block.hash),'missing canonical block');
 const snapshot=await readSnapshot({blockHash:block.hash,requireCanonical:true});
 const state=recoverPlayer(snapshot,{...expected,blockNumber:block.number});
 const check=await getBlock(block.number);
 assert(check&&same(check.hash,block.hash),'reorg during reconnect');
 return Object.freeze({state,blockHash:block.hash,blockNumber:block.number,snapshot});
}
