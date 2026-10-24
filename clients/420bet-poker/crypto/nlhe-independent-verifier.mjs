// Standalone audit-only NLHE transcript interpreter. It never accepts
// controller-reported winners or final seat balances. Inputs must be obtained
// from chain logs and checked against each hand's immutable state/event roots.
import {rank7,compareRank} from './nlhe-replay.mjs';
const requireTrue=(cond,message)=>{if(!cond)throw Error(message)};
const bit=i=>1<<i;
function clockwise(mask,from,n) {
  for(let i=1;i<=n;i++){const seat=(from+i)%n;if(mask&bit(seat))return seat;}
  throw Error('no eligible seat');
}
export function verifyBettingTranscript({stacks,button,smallBlind,bigBlind,actions,timeoutSeconds=60,startTimestamp}) {
  const n=stacks.length;
  requireTrue(n>=2&&n<=9&&Number.isInteger(button)&&button>=0&&button<n,'seats');
  requireTrue(Number.isSafeInteger(smallBlind)&&smallBlind>0&&Number.isSafeInteger(bigBlind)&&bigBlind===2*smallBlind,'blinds');
  requireTrue(Number.isInteger(timeoutSeconds)&&timeoutSeconds>=30&&timeoutSeconds<=3600,'turn policy');
  const timed=startTimestamp!==undefined;
  requireTrue(!timed||(Number.isSafeInteger(startTimestamp)&&startTimestamp>=0),'start timestamp');
  requireTrue(stacks.every(x=>Number.isSafeInteger(x)&&x>0),'stacks');
  const seats=stacks.map((stack,i)=>({stack,contributed:0,bet:0,folded:false,allIn:false,acted:false,lastFacing:0,seat:i}));
  const sb=n===2?button:(button+1)%n;
  const bb=(sb+1)%n;
  const ante=0;
  const pay=(seat,amount)=>{const p=seats[seat];requireTrue(amount>=0&&amount<=p.stack,'debit');p.stack-=amount;p.bet+=amount;p.contributed+=amount;p.allIn=p.stack===0;};
  pay(sb,Math.min(smallBlind,seats[sb].stack));
  pay(bb,Math.min(bigBlind,seats[bb].stack));
  let phase='PREFLOP',currentBet=bigBlind,minRaise=bigBlind,nonce=0,pot=seats.reduce((v,p)=>v+p.contributed,0);
  let pending=seats.reduce((mask,p)=>mask|(p.allIn?0:bit(p.seat)),0);
  if(seats.filter(p=>!p.allIn).length<=1){
    currentBet=Math.max(...seats.map(p=>p.bet));
    for(const p of seats)if(p.bet>=currentBet)pending&=~bit(p.seat);
  }
  let toAct=pending===0?-1:(n===2&&(pending&bit(sb))?sb:clockwise(pending,bb,n));
  if(pending===0)phase='AWAIT_FLOP';
  let turnDeadline=timed&&pending?startTimestamp+timeoutSeconds:null;
  let lastTimestamp=startTimestamp;
  const record=[];
  const countAlive=()=>seats.filter(x=>!x.folded).length;
  const playerMask=()=>seats.reduce((mask,p)=>mask|(!p.folded&&!p.allIn?bit(p.seat):0),0);
  const waitingStreet={PREFLOP:'AWAIT_FLOP',FLOP:'AWAIT_TURN',TURN:'AWAIT_RIVER',RIVER:'SHOWDOWN'};
  const streetAfter={AWAIT_FLOP:'FLOP',AWAIT_TURN:'TURN',AWAIT_RIVER:'RIVER'};
  const nextPending=(from)=>clockwise(pending,from,n);
  for(const event of actions) {
    requireTrue(event&&typeof event==='object','event');
    if(timed){
      requireTrue(Number.isSafeInteger(event.timestamp)&&event.timestamp>=lastTimestamp,'nonmonotonic timestamp');
      lastTimestamp=event.timestamp;
    }
    if(event.type==='reveal') {
      requireTrue(phase===event.from&&streetAfter[phase]===event.to,'premature reveal');
      requireTrue(event.accepted===true&&event.finalRootMatched===true,'unproved public card');
      phase=event.to;currentBet=0;minRaise=bigBlind;
      for(const p of seats){p.bet=0;p.lastFacing=0;p.acted=false;}
      pending=playerMask();
      if(seats.filter(p=>!p.folded&&!p.allIn).length<=1){phase=waitingStreet[phase];pending=0;}
      toAct=pending?clockwise(pending,button,n):-1;
      turnDeadline=timed&&pending?event.timestamp+timeoutSeconds:null;
      record.push({phase,type:'reveal',street:event.from,accepted:true});
      continue;
    }
    requireTrue(Number.isSafeInteger(event.nonce),'nonce');
    requireTrue(['PREFLOP','FLOP','TURN','RIVER'].includes(phase),'street/terminal');
    requireTrue(event.nonce===nonce+1,'nonce replay');
    requireTrue(event.seat===toAct&&(pending&bit(toAct))!==0,'out of turn');
    requireTrue(event.epochCurrent===true,'stale seat epoch');
    requireTrue(event.stateRootMatched===true,'forged expected state');
    const p=seats[event.seat];
    requireTrue(!p.folded&&!p.allIn,'inactive');
    const owed=Math.max(0,currentBet-p.bet);
    const amount=event.amount??0;
    requireTrue(Number.isSafeInteger(amount)&&amount>=0,'chips');
    if(event.type==='timeout') {
      requireTrue(!timed||event.deadline===turnDeadline,'forged turn deadline');
      requireTrue(Number.isSafeInteger(event.deadline)&&event.timestamp>event.deadline,'early timeout');
      requireTrue(event.move===(owed?'fold':'check')&&amount===0,'incorrect timeout');
      if(owed)p.folded=true;
    } else {
      requireTrue(!timed||event.timestamp<=turnDeadline,'expired turn');
      requireTrue(event.actionAuthorized!==false,'revoked action capability');
      requireTrue(event.signed===true&&event.signatureMatchesSeat===true&&event.expiry>=event.timestamp,'unauthenticated action');
      switch(event.type) {
      case 'fold':requireTrue(amount===0,'fold amount');p.folded=true;break;
      case 'check':requireTrue(owed===0&&amount===0,'check facing bet');break;
      case 'call':requireTrue(owed>0&&amount===Math.min(owed,p.stack),'bad call');pay(p.seat,amount);break;
      case 'raise':{
        requireTrue(playerMask().toString(2).replaceAll('0','').length>=2,'no opponent');
        requireTrue(amount>owed&&amount<=p.stack,'bad raise');
        requireTrue(!p.acted||currentBet-p.lastFacing>=minRaise,'underraise does not reopen');
        const increment=p.bet+amount-currentBet;
        const full=increment>=minRaise;
        requireTrue(full||amount===p.stack,'short raise not all-in');
        pay(p.seat,amount);currentBet=p.bet;
        if(full){minRaise=increment;pending=playerMask()&~bit(p.seat);}
        else for(const other of seats)if(other.seat!==p.seat&&!other.folded&&!other.allIn&&other.bet<currentBet)
          pending|=bit(other.seat);
        break;
      }
      default:throw Error('invalid move');
      }
    }
    p.acted=true;p.lastFacing=currentBet;
    pending&=~bit(p.seat);
    nonce++;pot=seats.reduce((value,player)=>value+player.contributed,0);
    record.push({nonce,phase,seat:p.seat,type:event.type,move:event.move??event.type,amount,currentBet,minRaise,pot,pending});
    if(countAlive()===1){phase='UNCONTESTED';pending=0;toAct=-1;}
    else if(pending===0){phase=waitingStreet[phase];toAct=-1;}
    else toAct=nextPending(p.seat);
    turnDeadline=timed&&pending?event.timestamp+timeoutSeconds:null;
  }
  requireTrue(seats.reduce((v,p)=>v+p.stack+p.contributed,0)===stacks.reduce((a,b)=>a+b,0),'chip conservation');
  return {seats,phase,nonce,pot,button,toAct,pending,currentBet,minRaise,record,turnDeadline,timingVerified:timed};
}
export function verifyShowdownSettlement({contributions,folded,holeCards,board,button=0,rake=0}) {
  const n=contributions.length;
  requireTrue(n>=2&&n<=9&&holeCards.length===n&&folded.length===n,'seats');
  requireTrue(board.length===5&&new Set(board).size===5,'authenticated board');
  requireTrue(contributions.every(x=>Number.isSafeInteger(x)&&x>=0)&&Number.isSafeInteger(rake)&&rake>=0,'pot/rake');
  const gross=contributions.reduce((a,b)=>a+b,0);
  requireTrue(rake<=gross,'excess rake');
  const payouts=Array(n).fill(0);
  const contribution=[...contributions];
  // Return only the unmatched portion of a unique maximum contributor,
  // independently of rank and irrespective of whether they folded.
  const order=[...contribution].sort((a,b)=>b-a);
  const max=Math.max(...contribution),top=contribution.filter(x=>x===max);
  let refund=0;
  if(top.length===1){refund=max-(order[1]??0);payouts[contribution.indexOf(max)]+=refund;contribution[contribution.indexOf(max)]-=refund;}
  const remainingGross=gross-refund;
  requireTrue(rake<=remainingGross,'rake above contested pot');
  const score=holeCards.map((cards,i)=>{
    if(folded[i])return null;
    requireTrue(Array.isArray(cards)&&cards.length===2&&new Set([...cards,...board]).size===7,'invalid or duplicate opened card');
    return rank7([...cards,...board]);
  });
  const tiers=[...new Set(contribution.filter(x=>x>0))].sort((a,b)=>a-b);
  let lower=0,remainingRake=rake;
  for(let k=0;k<tiers.length;k++){
    const tier=tiers[k];
    const eligible=contribution.map((v,i)=>v>=tier&&!folded[i]?i:-1).filter(x=>x>=0);
    requireTrue(eligible.length>0,'no eligible survivor');
    const amount=(tier-lower)*contribution.filter(x=>x>=tier).length;
    const last=k===tiers.length-1;
    const cut=last?remainingRake:Math.floor(rake*amount/remainingGross);
    requireTrue(cut<=amount&&cut<=remainingRake,'bad rake tier');
    remainingRake-=cut;
    let winners=[],best=null;
    for(const seat of eligible){
      if(best===null||compareRank(score[seat],best)>0){best=score[seat];winners=[seat];}
      else if(compareRank(score[seat],best)===0)winners.push(seat);
    }
    const share=Math.floor((amount-cut)/winners.length);
    let odd=(amount-cut)%winners.length;
    for(const i of winners)payouts[i]+=share;
    for(let step=1;step<=n&&odd>0;step++){
      const seat=(button+step)%n;if(winners.includes(seat)){payouts[seat]++;odd--;}
    }
    lower=tier;
  }
  requireTrue(remainingRake===0&&payouts.reduce((a,b)=>a+b,0)+rake===gross,'conservation');
  return {payouts,fee:rake,refund,tiers};
}
