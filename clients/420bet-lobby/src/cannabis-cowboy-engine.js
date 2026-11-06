// Cannabis Cowboy M3: independent practice-only 6x8 cluster engine.
// No wallet, server game service, tokens or gambling settlement dependencies.
export const COLUMNS=6, ROWS=8, CELL_COUNT=48;
export const MAX_CASCADES=200;
export const BET_CHOICES=Object.freeze([10,20,30,40,50]); // local demo credits only
export const START_CREDITS=10000;
export const SYMBOL_WEIGHTS=Object.freeze([16,15,14,13,12,11,10,9]); // id 0..7
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
export function findClusters(board){
 assertBoard(board);
 const visited=new Uint8Array(CELL_COUNT),found=[];
 for(let first=0;first<CELL_COUNT;first++){
  if(visited[first])continue;
  const symbol=board[first],queue=[first],positions=[];
  visited[first]=1;
  while(queue.length){
   const k=queue.pop();positions.push(k);
   const row=Math.floor(k/COLUMNS),col=k%COLUMNS;
   const neighbors=[col>0?k-1:-1,col<COLUMNS-1?k+1:-1,row>0?k-COLUMNS:-1,row<ROWS-1?k+COLUMNS:-1];
   for(const n of neighbors)if(n>=0&&!visited[n]&&board[n]===symbol){visited[n]=1;queue.push(n);}
  }
  if(positions.length>=5)found.push({symbol,positions:positions.sort((a,b)=>a-b),size:positions.length});
 }
 return found;
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
   const multiplier=bonuses.length?Math.min(500,bonuses.reduce((a,b)=>a+b,0)):1;
   const base=clusterPayout(cluster.symbol,cluster.size,bet);
   const payout=Math.round(base*multiplier);
   if(!Number.isSafeInteger(payout)||payout<0)throw new Error('Unsafe payout');
   paid.push({...cluster,multiplier,base,payout});
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
