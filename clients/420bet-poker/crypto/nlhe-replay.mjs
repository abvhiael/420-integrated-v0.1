// Deterministic, pure no-limit Texas Hold'em replay kernel.
// Inputs are authenticated externally; no trust in controller-supplied balances.
export function rank5(cards) {
  if(cards.length!==5||new Set(cards).size!==5||cards.some(x=>!Number.isInteger(x)||x<0||x>51)) throw Error('invalid cards');
  const ranks=cards.map(x=>x%13+2).sort((a,b)=>b-a);
  const suits=cards.map(x=>Math.floor(x/13));
  const frequency=new Map();for(const r of ranks) frequency.set(r,(frequency.get(r)||0)+1);
  const unique=[...new Set(ranks)];if(unique.includes(14)) unique.push(1);
  let straight=0;for(let i=0;i<=unique.length-5;i++) if(unique[i]-unique[i+4]===4) {straight=unique[i];break;}
  const flush=suits.every(x=>x===suits[0]);
  const groups=[...frequency].map(([r,n])=>({r,n})).sort((a,b)=>b.n-a.n||b.r-a.r);
  if(flush&&straight) return [8,straight];
  if(groups[0].n===4) return [7,groups[0].r,groups[1].r];
  if(groups[0].n===3&&groups[1].n===2)return [6,groups[0].r,groups[1].r];
  if(flush)return [5,...ranks];
  if(straight)return [4,straight];
  if(groups[0].n===3)return [3,groups[0].r,...groups.slice(1).map(x=>x.r).sort((a,b)=>b-a)];
  if(groups[0].n===2&&groups[1].n===2)return [2,Math.max(groups[0].r,groups[1].r),Math.min(groups[0].r,groups[1].r),groups[2].r];
  if(groups[0].n===2)return [1,groups[0].r,...groups.slice(1).map(x=>x.r).sort((a,b)=>b-a)];
  return [0,...ranks];
}
export function compareRank(a,b) {for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return Math.sign(d);}return 0;}
export function rank7(cards){
  if(cards.length!==7||new Set(cards).size!==7)throw Error('invalid seven cards');
  let best=null;
  for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++)for(let d=c+1;d<6;d++)for(let e=d+1;e<7;e++){
    const r=rank5([cards[a],cards[b],cards[c],cards[d],cards[e]]);
    if(!best||compareRank(r,best)>0)best=r;
  }
  return best;
}
function assertAmount(n){if(!Number.isSafeInteger(n)||n<0)throw Error('invalid chip amount');}
export function settlePots(contributions,folded,ranks,button=0){
  if(contributions.length<2||contributions.length>9||folded.length!==contributions.length||ranks.length!==contributions.length)throw Error('seat length');
  contributions.forEach(assertAmount);
  const tiers=[...new Set(contributions.filter(x=>x>0))].sort((a,b)=>a-b);
  const payouts=contributions.map(()=>0),pots=[];
  let previous=0;
  for(const tier of tiers){
    const participants=contributions.map((n,i)=>n>=tier?i:-1).filter(i=>i>=0);
    const amount=(tier-previous)*participants.length;
    assertAmount(amount);
    const eligible=participants.filter(i=>!folded[i]);
    if(!eligible.length)throw Error('no eligible winner');
    let best=null,winners=[];
    for(const i of eligible){
      if(!Array.isArray(ranks[i]))throw Error('missing verified hand');
      if(!best||compareRank(ranks[i],best)>0){best=ranks[i];winners=[i];}
      else if(compareRank(ranks[i],best)===0)winners.push(i);
    }
    const share=Math.floor(amount/winners.length);
    winners.forEach(i=>payouts[i]+=share);
    let odd=amount%winners.length;
    const clockwise=winners.sort((a,b)=>(a-button-1+contributions.length)%contributions.length-(b-button-1+contributions.length)%contributions.length);
    for(const i of clockwise){if(!odd)break;payouts[i]++;odd--;}
    pots.push({amount,eligible,winners:[...winners]});
    previous=tier;
  }
  if(payouts.reduce((a,b)=>a+b,0)!==contributions.reduce((a,b)=>a+b,0))throw Error('conservation');
  return {payouts,pots};
}
export function replayNLHE({stacks,button,smallBlind,bigBlind,actions}) {
  const n=stacks.length;
  if(n<2||n>9||!Number.isInteger(button)||button<0||button>=n||!Array.isArray(actions)||!Number.isSafeInteger(smallBlind)||smallBlind<=0||bigBlind!==smallBlind*2)throw Error('invalid game config');
  const remaining=[...stacks];remaining.forEach(assertAmount);
  const contributed=stacks.map(()=>0),streetPut=stacks.map(()=>0),folded=stacks.map(()=>false);
  const sb=(button+1)%n,bb=(button+2)%n;
  function pay(seat,amount){assertAmount(amount);if(amount>remaining[seat])throw Error('insufficient stack');remaining[seat]-=amount;contributed[seat]+=amount;streetPut[seat]+=amount;}
  pay(sb,Math.min(smallBlind,remaining[sb]));pay(bb,Math.min(bigBlind,remaining[bb]));
  let currentBet=Math.max(...streetPut),minRaise=bigBlind,toAct=(bb+1)%n,street=0,nonce=0;
  const history=[];
  for(const a of actions){
    if(!a||a.nonce!==++nonce||a.street!==street||a.seat!==toAct)throw Error('replay/turn/street');
    const i=a.seat;
    if(folded[i]||remaining[i]===0)throw Error('inactive player');
    const owed=currentBet-streetPut[i];
    const amount=a.amount??0;assertAmount(amount);
    if(a.type==='fold'){if(amount)throw Error('fold amount');folded[i]=true;}
    else if(a.type==='check'){if(owed!==0||amount!==0)throw Error('illegal check');}
    else if(a.type==='call'){if(amount!==Math.min(owed,remaining[i]))throw Error('illegal call');pay(i,amount);}
    else if(a.type==='raise'){
      if(amount<=owed||amount>remaining[i])throw Error('invalid raise');
      const raise=streetPut[i]+amount-currentBet;
      if(raise<minRaise&&amount!==remaining[i])throw Error('short non-all-in raise');
      pay(i,amount);
      if(raise>=minRaise)minRaise=raise;
      currentBet=streetPut[i];
    } else throw Error('unsupported action');
    history.push({nonce,street,seat:i,type:a.type,amount});
    if(folded.filter(x=>!x).length<2)break;
    let next=(i+1)%n;
    for(let k=0;k<n;k++,next=(next+1)%n){if(!folded[next]&&remaining[next]>0)break;}
    toAct=next;
  }
  const initial=stacks.reduce((a,b)=>a+b,0);
  if(initial!==remaining.reduce((a,b)=>a+b,0)+contributed.reduce((a,b)=>a+b,0))throw Error('conservation');
  return {remaining,contributed,folded,currentBet,minRaise,toAct,street,nonce,history};
}
