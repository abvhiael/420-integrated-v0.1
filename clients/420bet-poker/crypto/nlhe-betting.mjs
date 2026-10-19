// Pure, independently replayable no-limit Hold'em betting state machine.
// Signed authorization, deck proofs and settlement must be independently verified
// before treating a returned transcript as final or binding.
function amount(x){if(!Number.isSafeInteger(x)||x<0)throw Error('invalid amount');return x;}
export function replayBetting({stacks,button,smallBlind,bigBlind,actions,ante=0}) {
  const n=stacks?.length;
  if(!Array.isArray(stacks)||n<2||n>9||!Number.isInteger(button)||button<0||button>=n||
     !Number.isSafeInteger(smallBlind)||smallBlind<1||bigBlind!==2*smallBlind||
     !Number.isSafeInteger(ante)||ante<0||!Array.isArray(actions))throw Error('configuration');
  const remaining=stacks.map(amount),committed=Array(n).fill(0),streetPut=Array(n).fill(0);
  const folded=Array(n).fill(false),allIn=Array(n).fill(false);
  const original=remaining.reduce((a,b)=>a+b,0);amount(original);
  function debit(i,val){amount(val);if(remaining[i]<val)throw Error('insufficient funds');
    remaining[i]-=val;committed[i]+=val;streetPut[i]+=val;if(remaining[i]===0)allIn[i]=true;}
  function active(i){return !folded[i]&&!allIn[i];}
  function next(i){for(let k=1;k<=n;k++){const j=(i+k)%n;if(active(j))return j;}return null;}
  function liveCount(){return folded.filter(x=>!x).length;}
  for(let i=0;i<n;i++){debit(i,Math.min(ante,remaining[i]));streetPut[i]=0;}
  // Heads-up: dealer is small blind, other seat is big blind.
  const sb=n===2?button:(button+1)%n,bb=(sb+1)%n;
  debit(sb,Math.min(smallBlind,remaining[sb]));debit(bb,Math.min(bigBlind,remaining[bb]));
  let currentBet=Math.max(...streetPut),minRaise=bigBlind,street=0,nonce=0;
  let toAct=n===2?(active(sb)?sb:next(sb)):next(bb);
  // Pending action set tracks each player's right to respond to the current bet.
  let pending=new Set(remaining.map((_,i)=>active(i)?i:null).filter(x=>x!==null));
  // Track the bet amount each seat last acted against. Multiple short all-ins
  // cumulatively reopen betting only once the player faces a full-raise increment.
  let lastActedAgainst=Array(n).fill(null);
  const transcript=[];
  for(const a of actions){
    if(liveCount()<2)throw Error('hand already won by fold');
    if(street>3)throw Error('betting closed');
    if(pending.size===0)throw Error('unexpected action after betting complete');
    if(!a||a.nonce!==nonce+1||a.street!==street||a.seat!==toAct||!pending.has(toAct))throw Error('wrong nonce turn or street');
    const i=toAct,owed=Math.max(0,currentBet-streetPut[i]),v=amount(a.amount??0);
    const previousBet=currentBet;
    if(a.type==='fold'){if(v!==0)throw Error('fold carries amount');folded[i]=true;pending.delete(i);}
    else if(a.type==='check'){if(owed!==0||v!==0)throw Error('illegal check');pending.delete(i);}
    else if(a.type==='call'){
      if(owed===0||v!==Math.min(owed,remaining[i]))throw Error('illegal call');
      debit(i,v);pending.delete(i);
    } else if(a.type==='raise'){
      if(v<=owed||v>remaining[i])throw Error('illegal raise size');
      if(lastActedAgainst[i]!==null &&
         currentBet-lastActedAgainst[i]<minRaise)throw Error('betting not reopened');
      const size=streetPut[i]+v-currentBet;
      const full=size>=minRaise;
      if(!full&&v!==remaining[i])throw Error('short raise requires all-in');
      debit(i,v);currentBet=streetPut[i];
      if(full){minRaise=size;lastActedAgainst.fill(null);
        pending=new Set(remaining.map((_,j)=>active(j)&&j!==i?j:null).filter(x=>x!==null));}
      else{
        pending.delete(i);
        for(let j=0;j<n;j++)if(active(j)&&j!==i&&streetPut[j]<currentBet)pending.add(j);
      }
    } else throw Error('unknown action');
    // The acting seat has now exercised its opportunity at this bet level.
    lastActedAgainst[i]=currentBet;
    pending.delete(i);
    nonce++;
    transcript.push({nonce,street,seat:i,type:a.type,amount:v,committed:[...committed]});
    if(liveCount()<2){pending.clear();break;}
    // Close the street only when all non-all-in players have answered.
    if(!pending.size){
      if(street===3)break;
      street++;
      streetPut.fill(0);currentBet=0;minRaise=bigBlind;
      lastActedAgainst.fill(null);
      pending=new Set(remaining.map((_,j)=>active(j)?j:null).filter(x=>x!==null));
      if(pending.size<=1 && remaining.filter((_,j)=>!folded[j]&&!allIn[j]).length<=1){
        // No strategic action can occur without a live opponent. Board runout still required.
        street=4;pending.clear();break;
      }
      // After preflop, action begins at the first active seat left of the button.
      toAct=next(button);
    } else toAct=next(i);
  }
  const totalRemaining=remaining.reduce((a,b)=>a+b,0),totalCommitted=committed.reduce((a,b)=>a+b,0);
  if(totalRemaining+totalCommitted!==original)throw Error('chip conservation');
  const bettingComplete=liveCount()<2||street===4||(street===3&&pending.size===0);
  return {remaining,committed,folded,allIn,street,nonce,toAct,pending:[...pending],
    transcript,bettingComplete,totalRemaining,totalCommitted};
}
