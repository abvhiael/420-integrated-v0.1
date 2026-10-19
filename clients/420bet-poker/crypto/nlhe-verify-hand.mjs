// Standalone offline hand-result verifier. Never use before authorized reveal/finality:
// it requires the entire opened deck. The controller's own payouts are not trusted.
import {createHash,verify as verifySignature,createPublicKey} from 'node:crypto';
import {replayBetting} from './nlhe-betting.mjs';
import {rank7,settlePots} from './nlhe-replay.mjs';
import {verifyShuffle} from './confidential-deal.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const validHex=x=>typeof x==='string'&&/^[a-f0-9]{88,512}$/i.test(x);
export function actionDigest(ctx,nonce,action) {
  if(!ctx||!Number.isSafeInteger(ctx.chainId)||!/^0x[0-9a-f]{64}$/i.test(ctx.handId))
    throw Error('invalid hand domain');
  return Buffer.from(JSON.stringify(['420.BET.POKER.SIGNED.ACTION.V1',
    ctx.chainId,ctx.tableId,ctx.handId,ctx.rulesetId,ctx.epoch,nonce,
    action.seat,action.street,action.type,action.amount??0]));
}
export function verifySignedTranscript(context,seatPublicKeys,signedActions) {
  if(!Array.isArray(signedActions)||!Array.isArray(seatPublicKeys))throw Error('invalid transcript');
  return signedActions.map((entry,i)=>{
    const {signature,action}=entry;
    if(!action||action.nonce!==i+1||!validHex(signature)||!seatPublicKeys[action.seat])
      throw Error('missing action authentication');
    const key=createPublicKey({key:Buffer.from(seatPublicKeys[action.seat],'hex'),format:'der',type:'spki'});
    if(!verifySignature(null,actionDigest(context,i+1,action),key,Buffer.from(signature,'hex')))
      throw Error('invalid player signature');
    return action;
  });
}
export function independentlyVerifyOpenHand({context,commitments,seedA,seedB,openedDeck,
  stacks,button,smallBlind,bigBlind,ante=0,seatKeys,actions,claimedPayouts}){
  if(!verifyShuffle(context,commitments,seedA,seedB,openedDeck))throw Error('invalid deck proof');
  const verified=verifySignedTranscript(context,seatKeys,actions);
  const hand=replayBetting({stacks,button,smallBlind,bigBlind,ante,actions:verified});
  if(!hand.bettingComplete)throw Error('unfinished action transcript');
  // Mapping for this offline verifier only: two rounds from button's left to
  // each live seat, then burn-flop(3), burn-turn, burn-river.
  const n=stacks.length;
  const order=Array.from({length:n},(_,k)=>(button+1+k)%n);
  const hole=Array.from({length:n},()=>[]);
  let cursor=0;
  for(let round=0;round<2;round++)for(const seat of order)hole[seat].push(openedDeck[cursor++]);
  cursor++;const flop=openedDeck.slice(cursor,cursor+3);cursor+=3;
  cursor++;const turn=openedDeck[cursor++];
  cursor++;const river=openedDeck[cursor++];
  if(cursor>52)throw Error('overdraw');
  const board=[...flop,turn,river];
  const ranks=hole.map((cards,i)=>hand.folded[i]?null:rank7([...cards,...board]));
  const {payouts,pots}=settlePots(hand.committed,hand.folded,ranks,button);
  if(payouts.length!==claimedPayouts?.length||payouts.some((x,i)=>x!==claimedPayouts[i]))
    throw Error('payout does not match independent hand reconstruction');
  const finalStacks=hand.remaining.map((value,i)=>value+payouts[i]);
  if(finalStacks.reduce((a,b)=>a+b,0)!==stacks.reduce((a,b)=>a+b,0))
    throw Error('economic conservation');
  return {finalStacks,contributed:hand.committed,payouts,pots,board,
    transcriptHash:digest(verified),resultHash:digest({finalStacks,payouts,pots,board})};
}
