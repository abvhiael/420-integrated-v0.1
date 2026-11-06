// Cannabis Cowboy M3: independent practice-only 6x8 cluster engine.
// No wallet, server game service, tokens or gambling settlement dependencies.
export const COLUMNS=6, ROWS=8, CELL_COUNT=48;
export const MAX_CASCADES=200;
export const BET_CHOICES=Object.freeze([10,20,30,40,50]); // local demo credits only
export const START_CREDITS=10000;
export const WILD_SYMBOL=8;
export const SMOKE_RING_MULTIPLIER=2;
export const MAX_CLUSTER_MULTIPLIER=500;
// A low-frequency wildcard replaces any paying symbol; no scatter/bonus triggers in M4.
export const SYMBOL_WEIGHTS=Object.freeze([16,15,14,13,12,11,10,9,2]); // id 0..7 + wildcard
export const CLUSTER_PAYS=Object.freeze([
 Object.freeze([.4,.8,2.5,8,30]), // premium bud
 Object.freeze([.3,.6,2,6,20]),  // mason jar
 Object.freeze([.25,.5,1.5,5,15]), // guitar
 Object.freeze([.2,.4,1.2,4,12]), // vinyl
 Object.freeze([.15,.3,.9,3,9]), // boots
 Object.freeze([.1,.2,.6,2,6]), // horseshoe
 Object.freeze([.1,.2,.6,2,6]), // rolling papers
 Object.freeze([.5,1,3,10,40]) // Cole portrait
]);
const validBoard=board=>Array.isArray(board)&&board.length===CELL_COUNT&&board.every(v=>Number.isInteger(v)&&v>=0&&v<SYMBOL_WEIGHTS.length);
const assertBoard=board=>{if(!validBoard(board))throw new Error('A complete 48-symbol board is required');};
const bracket=size=>size>=20?4:size>=15?3:size>=10?2:size>=7?1:0;
export function clusterPayout(symbol,size,bet){
 if(!Number.isInteger(symbol)||symbol<0||symbol>=CLUSTER_PAYS.length||!Number.isInteger(size)||size<5||!Number.isSafeInteger(bet)||bet<0)throw new Error('Invalid cluster payout');
 return Math.round(CLUSTER_PAYS[symbol][bracket(size)]*bet);
}
export function weightedSymbol(rng=Math.random){
 const v=rng();
 if(!Number.isFinite(v)||v<0||v>=1)throw new Error('RNG must return a number in [0,1)');
 const total=SYMBOL_WEIGHTS.reduce((a,b)=>a+b,0);
 let x=v*total;
 for(let i=0;i<SYMBOL_WEIGHTS.length;i++){x-=SYMBOL_WEIGHTS[i];if(x<0)return i;}
 return SYMBOL_WEIGHTS.length-1;
}
export function makeBoard(rng=Math.random){return Array.from({length:CELL_COUNT},()=>weightedSymbol(rng));}
// A smoke ring substitutes for one paying symbol. Candidate groups are ranked by
// actual payout, then base symbol id and first position. Wild positions are
// allocated once per cascade, preventing duplicate payouts across groups.
export function findClusters(board){
 assertBoard(board);
 const candidates=[];
 for(let symbol=0;symbol<WILD_SYMBOL;symbol++){
  const visited=new Uint8Array(CELL_COUNT);
  for(let first=0;first<CELL_COUNT;first++){
   if(visited[first]||(board[first]!==symbol&&board[first]!==WILD_SYMBOL))continue;
   const stack=[first],positions=[];visited[first]=1;
   while(stack.length){
    const k=stack.pop();positions.push(k);
    const row=Math.floor(k/COLUMNS),col=k%COLUMNS;
    const near=[col>0?k-1:-1,col<COLUMNS-1?k+1:-1,row>0?k-COLUMNS:-1,row<ROWS-1?k+COLUMNS:-1];
    for(const n of near)if(n>=0&&!visited[n]&&(board[n]===symbol||board[n]===WILD_SYMBOL)){visited[n]=1;stack.push(n);}
   }
   if(positions.length>=5 && positions.some(p=>board[p]===symbol)){
    const sorted=positions.sort((a,b)=>a-b);
    candidates.push({symbol,positions:sorted,size:sorted.length,wildCount:sorted.filter(p=>board[p]===WILD_SYMBOL).length});
   }
  }
 }
 candidates.sort((a,b)=>clusterPayout(b.symbol,b.size,50)*(b.wildCount?SMOKE_RING_MULTIPLIER:1)-clusterPayout(a.symbol,a.size,50)*(a.wildCount?SMOKE_RING_MULTIPLIER:1)||a.symbol-b.symbol||a.positions[0]-b.positions[0]);
 const claimed=new Set(),found=[];
 for(const candidate of candidates){
  const available=candidate.positions.filter(p=>board[p]!==WILD_SYMBOL||!claimed.has(p));
  if(available.length<5)continue;
  // Recheck connectivity after a candidate has claimed shared smoke-ring wilds.
  const remaining=new Set(available);
  while(remaining.size){
   const first=remaining.values().next().value,stack=[first],component=[];remaining.delete(first);
   while(stack.length){
    const p=stack.pop();component.push(p);
    const col=p%COLUMNS,row=Math.floor(p/COLUMNS);
    const near=[col>0?p-1:-1,col<COLUMNS-1?p+1:-1,row>0?p-COLUMNS:-1,row<ROWS-1?p+COLUMNS:-1];
    for(const n of near)if(remaining.delete(n))stack.push(n);
   }
   if(component.length<5||!component.some(p=>board[p]===candidate.symbol))continue;
   component.sort((a,b)=>a-b);
   const wildPositions=component.filter(p=>board[p]===WILD_SYMBOL);
   for(const p of wildPositions)claimed.add(p);
   found.push({symbol:candidate.symbol,positions:component,size:component.length,wildCount:wildPositions.length,wildPositions});
  }
 }
 // Wild-only runs never award a cluster unless joined to a paying symbol.
 return found.sort((a,b)=>a.positions[0]-b.positions[0]||a.symbol-b.symbol);
}

export function dropAndRefill(board,removed,rng=Math.random){
 assertBoard(board);
 const hit=new Set(removed);
 if([...hit].some(i=>!Number.isInteger(i)||i<0||i>=CELL_COUNT))throw new Error('Invalid removal position');
 const result=board.slice(),refills=[];
 for(let c=0;c<COLUMNS;c++){
  const survivors=[];
  for(let r=ROWS-1;r>=0;r--){const i=r*COLUMNS+c;if(!hit.has(i))survivors.push(board[i]);}
  let cursor=0;
  for(let r=ROWS-1;r>=0;r--){
   const i=r*COLUMNS+c;
   if(cursor<survivors.length)result[i]=survivors[cursor++];
   else{result[i]=weightedSymbol(rng);refills.push(i);}
  }
 }
 return {board:result,refills};
}
export function resolveRound(initialBoard,bet,rng=Math.random,options={}){
 assertBoard(initialBoard);
 if(!BET_CHOICES.includes(bet))throw new Error('Unsupported practice wager');
 let board=initialBoard.slice(),fertile=Array(CELL_COUNT).fill(0),total=0;
 const steps=[];
 for(let i=0;i<MAX_CASCADES;i++){
  const clusters=findClusters(board);
  if(!clusters.length)return {startingBoard:initialBoard.slice(),board,steps,total,bet,won:total>0,fertile};
  const paid=[],removed=new Set();
  let cascadeWin=0;
  for(const cluster of clusters){
   const bonuses=cluster.positions.filter(p=>fertile[p]>0).map(p=>fertile[p]);
   const harvestMultiplier=bonuses.length?Math.min(MAX_CLUSTER_MULTIPLIER,bonuses.reduce((a,b)=>a+b,0)):1;
   const smokeMultiplier=cluster.wildCount?SMOKE_RING_MULTIPLIER:1;
   const multiplier=Math.min(MAX_CLUSTER_MULTIPLIER,harvestMultiplier*smokeMultiplier);
   const base=clusterPayout(cluster.symbol,cluster.size,bet);
   const payout=Math.round(base*multiplier);
   if(!Number.isSafeInteger(payout)||payout<0)throw new Error('Unsafe payout');
   paid.push({...cluster,multiplier,harvestMultiplier,smokeMultiplier,base,payout});
   cascadeWin+=payout;
   for(const p of cluster.positions)removed.add(p);
  }
  if(!Number.isSafeInteger(total+cascadeWin))throw new Error('Round exceeds safe credit accounting');
  total+=cascadeWin;
  for(const p of removed)fertile[p]=fertile[p]===0?2:Math.min(32,fertile[p]*2);
  const next=dropAndRefill(board,removed,rng);
  steps.push({index:i+1,before:board.slice(),clusters:paid,removed:[...removed].sort((a,b)=>a-b),after:next.board.slice(),refills:next.refills.slice(),fertile:fertile.slice(),cascadeWin,total});
  board=next.board;
 }
 // Bounded execution: fail closed, do not debit/credit a non-terminating round.
 throw new Error('Cascade safety bound reached: round rejected');
}
export function createPracticeSession({credits=START_CREDITS,bet=20,board=null,rng=Math.random}={}){
 if(!Number.isSafeInteger(credits)||credits<0||!BET_CHOICES.includes(bet))throw new Error('Invalid practice session');
 return {credits,bet,board:board?board.slice():makeBoard(rng),round:0};
}
export function playPracticeRound(state,rng=Math.random){
 if(!state||!Number.isSafeInteger(state.credits)||!BET_CHOICES.includes(state.bet))throw new Error('Invalid practice state');
 if(state.credits<state.bet)return {accepted:false,reason:'INSUFFICIENT_PRACTICE_CREDITS',state};
 // Refill a fresh board at the start of each round. Nothing persists into base spins.
 const generated=makeBoard(rng);
 const outcome=resolveRound(generated,state.bet,rng);
 const credits=state.credits-state.bet+outcome.total;
 if(!Number.isSafeInteger(credits)||credits<0)throw new Error('Unsafe credit update');
 return {accepted:true,outcome,state:{credits,bet:state.bet,board:outcome.board.slice(),round:state.round+1}};
}
