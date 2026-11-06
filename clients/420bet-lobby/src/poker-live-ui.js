import {createPokerReadOnlyClient} from './poker-authority-client.js';
import {blackjackCardArt} from './blackjack-card-art.js';
// Connected VIEW ONLY. Actions remain disabled until qualified backend commands
// and capability-scoped signing exist. Never derive canonical pots, deadlines,
// seat eligibility or cards from local engine code.
const make=(d,t,c,txt)=>{const e=d.createElement(t);if(c)e.className=c;if(txt!==undefined)e.textContent=txt;return e;};
const seatPositions=n=>n===2?[[50,83],[50,12]]:n===6?
 [[50,83],[17,67],[17,29],[50,9],[83,29],[83,67]]:
 [[50,83],[27,80],[8,63],[8,34],[27,12],[50,9],[73,12],[92,34],[92,63]];
function picture(d,card){const el=make(d,'div','pr-card');const img=make(d,'img','');img.src=blackjackCardArt(card);img.alt=card.rank+' '+card.suit;img.decoding='async';img.draggable=false;el.append(img);return el;}
const formatted=n=>Number(n).toLocaleString('en-US');
export function createPokerRoomLive(doc=globalThis.document,options={}){
 const win=doc.defaultView||globalThis,client=options.client||createPokerReadOnlyClient({base:options.base});
 const walletProvider=options.wallet||win.ethereum;
 const root=make(doc,'section','pr-room pr-room-live');
 root.dataset.practiceGame='live-poker';root.dataset.mode='authoritative-read-only';
 const intro=make(doc,'header','pr-intro');const ident=make(doc,'div','pr-identity');
 ident.append(make(doc,'small','','420BET · AUTHENTICATED TABLE VIEW'),make(doc,'h1','','THE HIGH STAKES LOUNGE'),
   make(doc,'p','','CANONICAL NO-LIMIT TEXAS HOLD’EM'));
 const connection=make(doc,'span','pr-preview-pill','CONNECTING · READ ONLY');
 intro.append(ident,connection);
 const body=make(doc,'div','pr-body');
 const sidebar=make(doc,'aside','pr-sidebar');
 sidebar.append(make(doc,'h2','','AUTHORITATIVE TABLES'),make(doc,'p','pr-sidebar-sub','Only tables returned by the verified poker projection service are listed.'));
 const tableList=make(doc,'div','pr-table-list');
 const refresh=make(doc,'button','pr-table-choice','REFRESH TABLES');refresh.type='button';
 const login=make(doc,'button','pr-table-choice pr-wallet-login','CONNECT WALLET · READ ONLY');
 login.type='button';
 sidebar.append(tableList,login,refresh);
 const stage=make(doc,'section','pr-stage');
 const heading=make(doc,'header','pr-table-heading');
 const headingName=make(doc,'div','','');const freshness=make(doc,'span','pr-status','NOT VERIFIED');
 heading.append(headingName,freshness);
 const wrap=make(doc,'div','pr-table-wrap');const felt=make(doc,'div','pr-felt');
 const logo=make(doc,'div','pr-felt-logo','420BET');logo.append(make(doc,'span','','♠ ♥ ♣ ♦'));
 const pot=make(doc,'div','pr-pot','POT · UNAVAILABLE');
 const cards=make(doc,'div','pr-community');felt.append(logo,pot,cards);wrap.append(felt);
 const seats=make(doc,'div','pr-seats');wrap.append(seats);
 const controls=make(doc,'section','pr-actions');
 const myCards=make(doc,'div','pr-your-hand','PRIVATE CARDS · NOT AVAILABLE');
 const buttons=make(doc,'div','pr-action-buttons');
 for(const label of ['FOLD','CHECK','CALL','RAISE']){
  const b=make(doc,'button','pr-action pr-'+label.toLowerCase(),label);b.disabled=true;b.type='button';
  b.title='No authorized action/settlement route connected';buttons.append(b);
 }
 const deadline=make(doc,'div','pr-action-note','TURN DEADLINE · UNAVAILABLE');
 controls.append(myCards,buttons,deadline);
 const disclosure=make(doc,'div','pr-disclosure');
 disclosure.append(make(doc,'strong','','READ-ONLY CANONICAL PROJECTION · NO BROWSER AUTHORITY'),
 make(doc,'p','','The server must verify chain state, signed actions, seat ownership and confidential deal proofs. This view cannot buy in, act, settle or reveal another player’s hole cards.'));
 stage.append(heading,wrap,controls,disclosure);body.append(sidebar,stage);
 root.append(intro,body,make(doc,'footer','pr-footer','420BET · AUTHENTICATED VIEW · TRANSACTIONS DISABLED'));
 let disposed=false,pollTimer=null,selection=null,previous=null,version=0,tables=[],connected=false;
 root.liveState={connected:false,table:null,error:null};
 const clearTimer=()=>{if(pollTimer!==null){win.clearTimeout?.(pollTimer);pollTimer=null;}};
 const stale=()=>{clearTimer();connected=false;previous=null;root.liveState.connected=false;root.liveState.table=null;
  connection.textContent='DISCONNECTED · PRIVATE STATE CLEARED';
  freshness.textContent='STALE / UNVERIFIED';pot.textContent='POT · UNAVAILABLE';
  cards.replaceChildren();seats.replaceChildren();myCards.textContent='PRIVATE CARDS · HIDDEN';
  deadline.textContent='TURN DEADLINE · UNAVAILABLE';
 };
 const schedule=()=>{if(disposed||options.autoPoll===false)return;clearTimer();pollTimer=win.setTimeout?.(()=>void updateSelected(),options.pollMs??2500)??null;};
 function showTable(snapshot){
  if(disposed)return;
  connected=true;root.liveState.connected=true;root.liveState.table=snapshot;root.liveState.error=null;
  connection.textContent='AUTHENTICATED · READ ONLY';
  freshness.textContent='VERIFIED BLOCK '+formatted(snapshot.blockNumber)+' · SEQ '+formatted(snapshot.sequence);
  headingName.replaceChildren(make(doc,'strong','',tables.find(t=>t.id===snapshot.id)?.name??snapshot.id),
   make(doc,'small','','HAND '+formatted(snapshot.handNonce)+' · '+snapshot.phase+' · V'+snapshot.tableVersion));
  pot.textContent='POT · '+formatted(snapshot.pot);
  cards.replaceChildren();for(const c of snapshot.community)cards.append(picture(doc,c));
  seats.replaceChildren();
  const coords=seatPositions(snapshot.seatCount);const mine=snapshot.viewer.seatPlusOne-1;
  snapshot.seats.forEach((s,i)=>{
   const p=coords[i];const seat=make(doc,'div','pr-seat'+(i===mine?' pr-hero-seat':''));
   seat.style.left=p[0]+'%';seat.style.top=p[1]+'%';
   seat.append(make(doc,'div','pr-avatar',i===mine?'YOU':String(i+1)),
    make(doc,'div','pr-seat-label',s.status==='empty'?'EMPTY':(i===mine?'YOU':s.displayName)+' · '+formatted(s.stack)));
   if(i===snapshot.dealerSeat)seat.append(make(doc,'span','pr-button','D'));
   seats.append(seat);
  });
  myCards.replaceChildren(make(doc,'span','','YOUR PRIVATE CARDS · '));
  if(snapshot.viewer.holeCards.length===2){
   const view=make(doc,'span','pr-hole-cards');for(const c of snapshot.viewer.holeCards)view.append(picture(doc,c));
   myCards.append(view);
  }else myCards.append(make(doc,'span','','NOT DEALT / NOT AUTHORIZED'));
  // Deadline is absolute server time, not a locally inferred game clock.
  deadline.textContent=snapshot.deadline?'TURN DEADLINE · '+new Date(snapshot.deadline).toLocaleTimeString()+
    ' · ACTING SEAT '+(snapshot.turnSeat+1):'NO ACTIVE ACTION DEADLINE';
 }
 async function updateSelected(){
  if(disposed||!selection)return;
  const v=++version,which=selection;
  try{
   const next=await client.readTable(which,previous);
   if(disposed||v!==version||selection!==which)return;
   previous=next;showTable(next);schedule();
  }catch(e){
   if(disposed||v!==version)return;
   stale();root.liveState.error=String(e?.message||'Read failed');
  }
 }
 function choose(id){
  if(disposed||!tables.some(t=>t.id===id))return;
  selection=id;previous=null;version++;stale();
  renderTableList();
  void updateSelected();
 }
 function renderTableList(){
  tableList.replaceChildren();
  if(!tables.length){tableList.append(make(doc,'p','pr-sidebar-sub','No verified tables available.'));return;}
  for(const t of tables){
   const b=make(doc,'button','pr-table-choice'+(t.id===selection?' pr-choice-active':''));b.type='button';
   b.append(make(doc,'strong','',t.name),make(doc,'span','','♠ '+t.occupied+'/'+t.seatCount+' seated · '+t.smallBlind+'/'+t.bigBlind),
    make(doc,'small','',t.phase+' · TABLE V'+t.tableVersion));
   b.addEventListener('click',()=>choose(t.id));tableList.append(b);
  }
 }
 async function discover(){
  const v=++version;stale();connection.textContent='AUTHENTICATING · READ ONLY';
  try{
   const currentSession=await client.authenticate();
   // A signed web session for a different wallet must never expose its cards
   // after the user switches accounts or chains in the EIP-1193 provider.
   if(walletProvider?.request){
    const [accounts,chainHex]=await Promise.all([
     walletProvider.request({method:'eth_accounts'}),
     walletProvider.request({method:'eth_chainId'})
    ]);
    const subject=Array.isArray(accounts)&&typeof accounts[0]==='string'?accounts[0].toLowerCase():null;
    const network=typeof chainHex==='string'&&/^0x[0-9a-f]+$/i.test(chainHex)?Number.parseInt(chainHex,16):null;
    if(subject!==currentSession.subject||network!==currentSession.chainId)
     throw Error('Wallet account or chain does not match authenticated poker session');
   }
   const list=await client.discover();
   if(disposed||v!==version)return;
   tables=list.tables;selection=tables.some(t=>t.id===selection)?selection:(tables[0]?.id??null);
   renderTableList();
   if(selection)void updateSelected();
   else{connection.textContent='AUTHENTICATED · NO TABLES';headingName.replaceChildren(make(doc,'strong','','NO VERIFIED TABLES'));}
  }catch(e){
   if(disposed||v!==version)return;
   tables=[];selection=null;renderTableList();stale();
   root.liveState.error=String(e?.message||'No authenticated poker service');
   connection.textContent='OFFLINE · UNVERIFIED';
  }
 }
 login.addEventListener('click',async()=>{
  login.disabled=true;login.textContent='SIGNING READ-ONLY SESSION…';
  try{
   await client.loginWallet(options.wallet||win.ethereum,win.location?.origin);
   if(!disposed){login.textContent='SESSION CONNECTED · READ ONLY';await discover();}
  }catch(e){
   if(!disposed){login.textContent='CONNECT WALLET · READ ONLY';
    stale();root.liveState.error=String(e?.message||'Wallet authentication failed');
    connection.textContent='WALLET LOGIN UNAVAILABLE';}
  }finally{if(!disposed)login.disabled=false;}
 });
 refresh.addEventListener('click',()=>{client.disconnect();void discover();});
 const walletChanged=()=>{
  if(disposed)return;
  version++;client.disconnect();stale();
  connection.textContent='WALLET CHANGED · SIGN IN AGAIN';
 };
 if(walletProvider?.on){
  for(const event of ['accountsChanged','chainChanged','disconnect'])
   walletProvider.on(event,walletChanged);
 }
 root.stopAnimation=()=>{
  disposed=true;version++;stale();client.dispose?.();
  for(const event of ['accountsChanged','chainChanged','disconnect'])
   walletProvider?.removeListener?.(event,walletChanged);
 };
 root.refreshPoker=()=>discover();
 root.ready=discover();
 return root;
}
