// Read-only browser projection of the canonical multiplayer poker system.
// The server, not the client, MUST authenticate the user, pin finalized chain
// context, validate signatures/proofs, and redact all other players' hole cards.
// An EIP-1193 address, websocket payload or HTTP 200 alone is never authority.
export const POKER_SOURCE='canonical-poker-projection-v1';
export const POKER_PHASES=Object.freeze(['TABLE_OPEN','SEATED','HAND_COMMITTED','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','SETTLED','ABORTED','REFUNDED','DISPUTED']);
const ids=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/;
const hash=/^0x[0-9a-fA-F]{64}$/;
const address=/^0x[0-9a-fA-F]{40}$/;
const int=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const nonblank=(v,max=100)=>typeof v==='string'&&v.length>0&&v.length<=max;
const card=c=>c&&typeof c==='object'&&['2','3','4','5','6','7','8','9','10','J','Q','K','A'].includes(String(c.rank))&&['♠','♥','♦','♣'].includes(c.suit);
const one=(p,m)=>{if(!p)throw Error('Unverified poker projection: '+m);};
export function pokerApiPath(path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\?#\r\n]/.test(path))return null;
 try{const u=new URL(path,'https://local.invalid');return u.origin==='https://local.invalid'&&u.pathname===path&&path.length<=160?path.replace(/\/$/,''):null;}catch{return null;}
}
function parseEnvelope(data,session){
 one(data&&data.source===POKER_SOURCE&&data.authority==='verified','missing canonical authority');
 one(data.chainId===session.chainId&&data.viewerId===session.viewerId,'viewer or chain mismatch');
 one(nonblank(data.stateHash,66)&&hash.test(data.stateHash),'missing pinned state hash');
 one(int(data.blockNumber,1)&&int(data.sequence,0),'invalid block/sequence');
 one(int(data.observedAt,1)&&data.observedAt<=Date.now()+30000&&Date.now()-data.observedAt<=30000,'stale snapshot');
 return data;
}
export function parsePokerSession(data,now=Date.now()){
 one(data&&data.authenticated===true&&data.scope==='poker:read','unauthenticated session');
 one(nonblank(data.viewerId,80)&&ids.test(data.viewerId),'invalid viewer');
 one(int(data.chainId,1),'invalid chain');
 one(int(data.expiresAt,now+1)&&data.expiresAt<=now+86400000,'expired/invalid session');
 one(typeof data.subject==='string'&&address.test(data.subject),'unbound player subject');
 return Object.freeze({viewerId:data.viewerId,chainId:data.chainId,expiresAt:data.expiresAt,subject:data.subject.toLowerCase()});
}
export function parsePokerTables(data,session){
 const e=parseEnvelope(data,session);
 one(Array.isArray(e.tables)&&e.tables.length<=100,'invalid tables');
 const seen=new Set();
 const tables=e.tables.map(t=>{
  one(t&&ids.test(t.id)&&!seen.has(t.id),'invalid/duplicate table');
  seen.add(t.id);
  one(nonblank(t.name,64)&&int(t.seatCount,2,9)&&int(t.occupied,0,t.seatCount),'invalid table seats');
  one(int(t.smallBlind,0)&&int(t.bigBlind,1)&&t.bigBlind>=t.smallBlind,'invalid blinds');
  one(POKER_PHASES.includes(t.phase),'invalid table phase');
  one(int(t.tableVersion,1),'unversioned table');
  return Object.freeze({id:t.id,name:t.name,seatCount:t.seatCount,occupied:t.occupied,smallBlind:t.smallBlind,bigBlind:t.bigBlind,phase:t.phase,tableVersion:t.tableVersion});
 });
 return Object.freeze({sequence:e.sequence,blockNumber:e.blockNumber,stateHash:e.stateHash,tables});
}
export function parsePokerTable(data,session,requestedTableId,previous=null){
 const e=parseEnvelope(data,session);
 one(e.table&&e.table.id===requestedTableId&&ids.test(e.table.id),'table context mismatch');
 const t=e.table;
 one(int(t.tableVersion,1)&&int(t.seatCount,2,9)&&int(t.dealerSeat,0,t.seatCount-1),'invalid table configuration');
 one(POKER_PHASES.includes(t.phase)&&int(t.handNonce)&&int(t.actionNonce)&&int(t.ledgerVersion,0),'invalid hand ledger');
 one(int(t.pot,0)&&int(t.deadline,0,4102444800000)&&int(t.turnSeat,0,t.seatCount-1),'invalid pot or turn');
 one(!('deck' in t)&&!('holeCards' in t)&&!('privateCards' in t)&&!('shuffleSeed' in t),'hidden game state leaked');
 one(Array.isArray(t.community)&&t.community.length<=5&&t.community.every(card),'invalid community cards');
 const communitySeen=new Set(t.community.map(c=>String(c.rank)+c.suit));
 one(communitySeen.size===t.community.length,'duplicate community cards');
 const maxCommunity=({PREFLOP:0,FLOP:3,TURN:4,RIVER:5,SHOWDOWN:5})[t.phase];
 if(maxCommunity!==undefined)one(t.community.length<=maxCommunity,'premature community reveal');
 one(Array.isArray(t.seats)&&t.seats.length===t.seatCount,'invalid seat array');
 const seats=t.seats.map((s,i)=>{
  one(s&&s.index===i&&['empty','active','folded','sitting-out','all-in','disconnected'].includes(s.status),'invalid seat');
  one(int(s.stack,0)&&int(s.committed,0),'invalid stack/commitment');
  one(s.status==='empty'?s.playerId===null:nonblank(s.playerId,80),'invalid seat owner');
  one(!('holeCards' in s)&&!('privateCards' in s)&&!('deck' in s),'other player private cards leaked');
  return Object.freeze({index:i,status:s.status,playerId:s.playerId,displayName:nonblank(s.displayName,30)?s.displayName:'PLAYER '+(i+1),stack:s.stack,committed:s.committed});
 });
 const me=t.viewer;
 one(me&&int(me.seatPlusOne,0,t.seatCount),'invalid viewer seat');
 one(me.seatPlusOne===0||seats[me.seatPlusOne-1].playerId===session.viewerId,'viewer seat not owned by session');
 one(Array.isArray(me.holeCards)&&[0,2].includes(me.holeCards.length)&&me.holeCards.every(card),'invalid hole cards');
 one(me.seatPlusOne!==0||me.holeCards.length===0,'spectator has private cards');
 if(me.holeCards.length===2){
  one(t.phase!=='TABLE_OPEN'&&t.phase!=='SEATED','hole cards before deal');
  for(const c of me.holeCards)one(!communitySeen.has(String(c.rank)+c.suit),'duplicate card with board');
 }
 if(previous){
  one(e.blockNumber>=previous.blockNumber,'chain block regression');
  one(e.sequence>=previous.sequence,'stale/replayed table snapshot');
  if(e.sequence===previous.sequence)one(e.stateHash===previous.stateHash&&e.blockNumber===previous.blockNumber,
    'same-version snapshot mutated');
  one(t.tableVersion===previous.tableVersion,'table version changed; resubscribe');
  one(t.handNonce>=previous.handNonce,'hand nonce regression');
  if(t.handNonce===previous.handNonce)one(t.actionNonce>=previous.actionNonce&&t.ledgerVersion>=previous.ledgerVersion,'action or ledger regression');
 }
 return Object.freeze({
  id:t.id,tableVersion:t.tableVersion,seatCount:t.seatCount,dealerSeat:t.dealerSeat,
  phase:t.phase,handNonce:t.handNonce,actionNonce:t.actionNonce,ledgerVersion:t.ledgerVersion,
  pot:t.pot,deadline:t.deadline,turnSeat:t.turnSeat,
  community:t.community.map(c=>Object.freeze({rank:String(c.rank),suit:c.suit})),
  seats,viewer:Object.freeze({seatPlusOne:me.seatPlusOne,holeCards:me.holeCards.map(c=>Object.freeze({rank:String(c.rank),suit:c.suit}))}),
  sequence:e.sequence,blockNumber:e.blockNumber,stateHash:e.stateHash
 });
}
export function createPokerReadOnlyClient({base,fetcher=globalThis.fetch,clock=()=>Date.now()}={}){
 const path=pokerApiPath(base);
 if(!path||typeof fetcher!=='function')throw Error('Poker API not configured');
 let session=null,epoch=0,disposed=false;
 async function request(suffix){
  const current=epoch;
  const response=await fetcher(path+suffix,{method:'GET',credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
  one(!disposed&&current===epoch,'connection reset');
  one(response&&response.ok,'authoritative poker API unavailable');
  const type=response.headers?.get?.('content-type')||'';
  one(/^application\/json(?:;|$)/i.test(type),'invalid response content type');
  const data=await response.json();
  one(!disposed&&current===epoch,'connection reset');
  return data;
 }
 async function authenticate(){
  session=null;const data=await request('/session');session=parsePokerSession(data,clock());return session;
 }
 function authorized(){one(session&&clock()<session.expiresAt&&!disposed,'poker session expired');return session;}
 async function discover(){const auth=authorized();return parsePokerTables(await request('/tables'),auth);}
 async function readTable(tableId,previous=null){
  one(typeof tableId==='string'&&ids.test(tableId),'invalid table identifier');
  const auth=authorized();
  return parsePokerTable(await request('/tables/'+encodeURIComponent(tableId)+'/snapshot'),auth,tableId,previous);
 }
 function disconnect(){epoch++;session=null;}
 return Object.freeze({authenticate,discover,readTable,disconnect,dispose(){disposed=true;disconnect();}});
}
