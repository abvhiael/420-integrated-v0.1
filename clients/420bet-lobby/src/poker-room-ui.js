import {blackjackCardArt,blackjackCardBack} from './blackjack-card-art.js';
// Read-only visual preview of NLHE tables. No fake connection, players or wagers.
const ROOM_TABLES=Object.freeze([
 {id:'6-max',title:'Emerald Six',seats:6,blind:'10 / 20',min:400,max:2000},
 {id:'9-max',title:'Royal Garden',seats:9,blind:'5 / 10',min:200,max:1000},
 {id:'heads-up',title:'High Noon',seats:2,blind:'25 / 50',min:1000,max:5000}
]);
export const POKER_ROOM_DEMO_TABLES=ROOM_TABLES;
const sampleBoard=Object.freeze([{rank:'A',suit:'♠'},{rank:'10',suit:'♥'},{rank:'J',suit:'♦'},{rank:'2',suit:'♣'},{rank:'K',suit:'♠'}]);
const make=(d,t,c,txt)=>{const e=d.createElement(t);if(c)e.className=c;if(txt!==undefined)e.textContent=txt;return e;};
const seatsFor=n=>n===2?[{x:50,y:80},{x:50,y:12}]:n===6?
 [{x:50,y:83},{x:17,y:67},{x:17,y:29},{x:50,y:9},{x:83,y:29},{x:83,y:67}]:
 [{x:50,y:83},{x:27,y:80},{x:8,y:63},{x:8,y:34},{x:27,y:12},{x:50,y:9},{x:73,y:12},{x:92,y:34},{x:92,y:63}];
function graphicCard(d,c){const div=make(d,'div','pr-card');const img=make(d,'img','');img.src=blackjackCardArt(c);img.alt=c.rank+' '+c.suit;img.decoding='async';img.draggable=false;img.addEventListener('error',()=>{img.hidden=true;div.append(make(d,'span','pr-card-alt',c.rank+c.suit));});div.append(img);return div;}
export function createPokerRoomPreview(doc=globalThis.document){
 const root=make(doc,'section','pr-room');
 root.dataset.practiceGame='live-poker';
 root.dataset.previewOnly='true';
 let selected=ROOM_TABLES[0];
 const intro=make(doc,'header','pr-intro');
 const identity=make(doc,'div','pr-identity');
 identity.append(make(doc,'small','','420BET ORIGINALS'),make(doc,'h1','','THE HIGH STAKES LOUNGE'),make(doc,'p','','LIVE MULTIPLAYER POKER · TEXAS HOLD’EM'));
 const pill=make(doc,'span','pr-preview-pill','INTERFACE PREVIEW · NOT CONNECTED');
 intro.append(identity,pill);
 const body=make(doc,'div','pr-body');
 const sidebar=make(doc,'aside','pr-sidebar');
 sidebar.append(make(doc,'h2','','TABLE LOBBY'),make(doc,'p','pr-sidebar-sub','Choose a table layout to inspect. All seats and chips shown are illustrative.'));
 const list=make(doc,'div','pr-table-list');
 sidebar.append(list);
 const footer=make(doc,'div','pr-sidebar-footer');
 footer.append(make(doc,'span','','NO-LIMIT HOLD’EM'),make(doc,'small','','2–9 seats · Demo layouts only'));
 sidebar.append(footer);
 const stage=make(doc,'div','pr-stage');
 const top=make(doc,'header','pr-table-heading');
 const stageTitle=make(doc,'div','','');
 const status=make(doc,'span','pr-status','● OFFLINE PREVIEW');
 top.append(stageTitle,status);
 const tableWrap=make(doc,'div','pr-table-wrap');
 const felt=make(doc,'div','pr-felt');
 const name=make(doc,'div','pr-felt-logo','420BET');
 name.append(make(doc,'span','','♠ ♥ ♣ ♦'));
 const pot=make(doc,'div','pr-pot','POT · EXAMPLE 180');
 const community=make(doc,'div','pr-community');for(const c of sampleBoard)community.append(graphicCard(doc,c));
 felt.append(name,pot,community);
 tableWrap.append(felt);
 const seats=make(doc,'div','pr-seats');
 tableWrap.append(seats);
 const controls=make(doc,'section','pr-actions');
 controls.append(make(doc,'div','pr-your-hand','YOUR HOLE CARDS · NOT DEALT'));
 const buttons=make(doc,'div','pr-action-buttons');
 for(const [label,cls] of [['FOLD','pr-fold'],['CHECK','pr-check'],['CALL','pr-call'],['RAISE','pr-raise']]){
  const b=make(doc,'button','pr-action '+cls,label);b.disabled=true;b.type='button';
  b.title='Requires an authenticated real-time poker session';buttons.append(b);
 }
 controls.append(buttons,make(doc,'div','pr-action-note','Actions will unlock only after a verified multiplayer session is connected.'));
 const explain=make(doc,'div','pr-disclosure');
 explain.append(make(doc,'strong','','PREVIEW ONLY — NO LIVE PLAYERS OR FUNDS'),make(doc,'p','','This is a visual poker-room foundation. Sample seats, community cards, pot and chip stacks are illustrative—not real game events. No wallet, buy-in, shuffle, private cards, chat or multiplayer transport is connected.'));
 stage.append(top,tableWrap,controls,explain);
 body.append(sidebar,stage);
 const foot=make(doc,'footer','pr-footer','420BET · POKER ROOM UI · NO WAGERING OR LIVE TABLE AUTHORITY');
 root.append(intro,body,foot);
 function render(){
  list.replaceChildren();for(const t of ROOM_TABLES){
   const item=make(doc,'button','pr-table-choice'+(t.id===selected.id?' pr-choice-active':''));item.type='button';item.setAttribute('aria-pressed',String(t.id===selected.id));
   item.append(make(doc,'strong','',t.title),make(doc,'span','','♠ '+t.seats+' seats · '+t.blind+' blinds'),make(doc,'small','','Buy-in guide '+t.min.toLocaleString()+'–'+t.max.toLocaleString()+' · demo'));
   item.addEventListener('click',()=>{selected=t;render();});list.append(item);
  }
  stageTitle.replaceChildren(make(doc,'strong','',selected.title),make(doc,'small','','NO-LIMIT TEXAS HOLD’EM · '+selected.seats+' SEATS · BLINDS '+selected.blind));
  seats.replaceChildren();
  const coords=seatsFor(selected.seats);coords.forEach((p,i)=>{
   const wrap=make(doc,'div','pr-seat'+(i===0?' pr-hero-seat':''));wrap.style.left=p.x+'%';wrap.style.top=p.y+'%';
   wrap.append(make(doc,'div','pr-avatar',i===0?'YOU':String(i+1)),
     make(doc,'div','pr-seat-label',i===0?'YOUR SEAT · PREVIEW':'EMPTY · '+(i+1)));
   if(i===selected.seats-1)wrap.append(make(doc,'span','pr-button','D'));
   seats.append(wrap);
  });
 }
 render();root.stopAnimation=()=>{};return root;
}
