// Cross-Country Chaos CCC-1: deterministic, local-only rules. No wallet or wager authority.
// All round and championship accounting derives exclusively from this state machine.
export const LEGS=Object.freeze([
 {id:'east',name:'The Down East Disaster',from:"St. John's",to:'Montréal',target:2500},
 {id:'ontario',name:'The Never-Ending Ontario',from:'Montréal',to:'Kenora',target:2500},
 {id:'west',name:'Prairie Madness & Mountain Mayhem',from:'Kenora',to:'Vancouver',target:2500}
]);
export const MILEAGE_VALUES=Object.freeze([100,150,200,250,300,400,500]);
export const MILEAGE_COUNTS=Object.freeze([[100,30],[150,26],[200,22],[250,18],[300,14],[400,10],[500,6]]);
export const HAZARDS=Object.freeze({
 east:[
  {id:'ferry',name:"Ferry Cancelled, B'y!",category:'road',kind:'block'},
  {id:'moose',name:'Moose on the Loose',category:'road',kind:'slow',amount:150},
  {id:'fog',name:'Fog Thicker Than Pea Soup',category:'weather',kind:'slow',amount:150},
  {id:'cabot',name:'Cabot Trail Temptation',category:'navigation',kind:'detour',amount:150},
  {id:'construction',name:'Quebec Construction Season',category:'road',kind:'detour',amount:150},
  {id:'gander',name:'Out of Gas in Gander',category:'fuel',kind:'block'},
  {id:'pothole',name:'Pothole from Hell',category:'mechanical',kind:'block'},
  {id:'montreal',name:'Wrong Turn in Montréal',category:'navigation',kind:'detour',amount:100}
 ],
 ontario:[
  {id:'still-ontario',name:'Still in Ontario?!',category:'navigation',kind:'detour',amount:150},
  {id:'whiteout',name:'Lake Superior Whiteout',category:'weather',kind:'block'},
  {id:'blackfly',name:'Blackfly Apocalypse',category:'road',kind:'slow',amount:100},
  {id:'wawa',name:'The Wawa Goose Incident',category:'road',kind:'slow',amount:100},
  {id:'traffic',name:'Toronto Traffic Nightmare',category:'road',kind:'slow',amount:200},
  {id:'flat',name:'Flat Tire Near Thunder Bay',category:'mechanical',kind:'block'},
  {id:'closed',name:'The Trans-Canada Is Closed',category:'navigation',kind:'detour',amount:200},
  {id:'convoy',name:'Transport Truck Convoy',category:'road',kind:'slow',amount:100}
 ],
 west:[
  {id:'mosquito',name:'Manitoba Mosquito Air Force',category:'road',kind:'slow',amount:100},
  {id:'prairie-pothole',name:'Saskatchewan Pothole',category:'mechanical',kind:'block'},
  {id:'headwind',name:'Prairie Headwind',category:'weather',kind:'slow',amount:150},
  {id:'hail',name:'Alberta Hailstorm',category:'weather',kind:'block'},
  {id:'cattle',name:'Cattle on the Highway',category:'road',kind:'slow',amount:100},
  {id:'moose-jaw',name:'Out of Gas Near Moose Jaw',category:'fuel',kind:'block'},
  {id:'rogers',name:'Rogers Pass Whiteout',category:'weather',kind:'block'},
  {id:'washout',name:'BC Highway Washout',category:'navigation',kind:'detour',amount:200}
 ]
});
export const FIXES=Object.freeze([
 {id:'toolbox',name:'Emergency Repair Kit',category:'mechanical'},
 {id:'atlas',name:'Local Knows a Shortcut',category:'navigation'},
 {id:'plows',name:'Clear Skies & Plows',category:'weather'},
 {id:'jerry',name:'Emergency Jerry Can',category:'fuel'},
 {id:'detour',name:'Alternate Route',category:'road'},
 {id:'help',name:'Roadside Assistance',category:'all'}
]);
export const UPGRADES=Object.freeze([
 {id:'duct-tape',name:'The Magic Roll of Duct Tape',category:'mechanical',description:'Negate one mechanical hazard each leg.'},
 {id:'road-atlas',name:"Dad's Old Road Atlas",category:'navigation',description:'Negate one navigation hazard each leg.'},
 {id:'winter-tires',name:'Canadian Winter Tires',category:'weather',description:'Negate one weather hazard each leg.'},
 {id:'jerry-can',name:'The Emergency Jerry Can',category:'fuel',description:'Negate one fuel hazard each leg.'},
 {id:'cb-radio',name:'CB Radio',category:'road',description:'Negate one road hazard each leg.'},
 {id:'station-wagon',name:'The Indestructible Station Wagon',category:'mechanical',description:'Automatically repair one mechanical breakdown at the beginning of your turn.'},
 {id:'thermos',name:'Bottomless Thermos',category:'all',description:'Negate one hazard of any type each leg.'},
 {id:'shortcut-specialist',name:'Shortcut Specialist',category:'boost',description:'Add 100 km to one drive each leg.'}
]);
export const LEGENDARIES=Object.freeze([
 {id:'truck',name:'A Guy I Know Has a Truck',description:'Clear your hazard and advance 100 km.'},
 {id:'rodeo',name:'Not My First Rodeo',description:'Negate the next two hazards aimed at you.'},
 {id:'shortcut',name:'Trust Me, I Know a Shortcut',description:'Advance 300 km and face one regional hazard.'},
 {id:'sunshine',name:'Would You Look at That!',description:'Clear every active weather hazard; advance 100 km.'}
]);

export const STANDARD_DECK_SIZE=278;
const clone=x=>JSON.parse(JSON.stringify(x));
function log(s,message){s.log.unshift(message);s.log.length=Math.min(s.log.length,30);}
function roll(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function shuffle(s,cards){
 const shuffled=cards.map(clone);
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(roll(s)*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 return shuffled;
}
function instance(s,card){return {...card,uid:++s.serial};}
function distributeLegendaries(s){
 const order=shuffle(s,LEGENDARIES.map(x=>x.id));
 const extra=Math.floor(roll(s)*LEGS.length);
 const allocation=[[],[],[]];
 for(let i=0;i<3;i++)allocation[i].push(order[i]);
 allocation[extra].push(order[3]);
 return allocation;
}
export function regionalDeck(s){
 const leg=LEGS[s.leg].id;
 const cards=[
  ...MILEAGE_COUNTS.flatMap(([km,count])=>Array.from({length:count},()=>({type:'mileage',km}))),
  ...HAZARDS[leg].flatMap(card=>Array.from({length:9},()=>({...card,type:'hazard'}))),
  ...FIXES.flatMap(card=>Array.from({length:12},()=>({...card,type:'fix'}))),
  ...UPGRADES.map(card=>({...card,type:'upgrade'})),
  ...s.legendaryByLeg[s.leg].map(id=>({...LEGENDARIES.find(x=>x.id===id),type:'legendary'}))
 ];
 if(cards.length!==STANDARD_DECK_SIZE+s.legendaryByLeg[s.leg].length)throw Error('Invalid regional deck configuration.');
 return shuffle(s,cards.map(c=>instance(s,c)));
}
function deckDraw(s){
 if(!s.deck.length&&s.discard.length>1){
  const last=s.discard.pop();
  s.deck=shuffle(s,s.discard);
  s.discard=[last];
  log(s,'Reshuffled eligible discards; the top discard remains visible.');
 }
 return s.deck.pop()||null;
}
function deal(s){for(const p of s.players)for(let i=0;i<7;i++){const c=deckDraw(s);if(!c)throw Error('Regional deck could not deal seven cards.');p.hand.push(c);}}
function effective(p){
 return Math.max(0,p.played.reduce((sum,c)=>sum+c.km,0)+p.bonusKm-p.slowLoss-p.detourLoss);
}
function refresh(p){p.km=effective(p);}
function gain(p,km){p.bonusKm+=km;refresh(p);}
function discardPlayed(s,card){s.spent.push(card);}
function canTarget(p,h){
 return h.kind==='detour'||!p.status;
}
export function canFix(status,fix){
 return Boolean(status&&fix?.type==='fix'&&fix.id!=='atlas'&&(fix.category===status.category||fix.category==='all'));
}
function protectedBy(s,p,h){
 const usable=p.upgrades.find(u=>u.id!=='station-wagon'&&u.id!=='shortcut-specialist'&&u.category===h.category&&!p.used.includes(u.id))
  ||p.upgrades.find(u=>u.category==='all'&&!p.used.includes(u.id));
 if(usable){p.used.push(usable.id);log(s,p.name+' blocked '+h.name+' with '+usable.name+'.');return true;}
 if(p.shield>0){p.shield--;log(s,p.name+' blocked '+h.name+' using a legendary shield.');return true;}
 return false;
}
function hit(s,p,h){
 if(!canTarget(p,h))throw Error('Target already has an ongoing hazard.');
 if(protectedBy(s,p,h))return;
 if(h.kind==='detour'){
  const lost=Math.min(p.km,h.amount);
  p.detourLoss+=lost;refresh(p);
  log(s,p.name+': '+h.name+' (permanent -'+lost+' km this stage).');
  return;
 }
 p.status=clone(h);
 log(s,p.name+' hit by '+h.name+'.');
}
function risky(s,p,printedKm){
 if(printedKm<=300)return;
 const hazards=HAZARDS[LEGS[s.leg].id].filter(h=>canTarget(p,h));
 const hazard=hazards[Math.floor(roll(s)*hazards.length)];
 log(s,p.name+' risked a '+printedKm+' km drive.');
 hit(s,p,{...hazard,type:'hazard'});
}
function atStartOfTurn(s){
 const p=s.players[s.turn];
 const wagon=p.upgrades.find(u=>u.id==='station-wagon'&&!p.used.includes(u.id));
 if(wagon&&p.status?.kind==='block'&&p.status.category==='mechanical'){
  p.used.push(wagon.id);p.status=null;log(s,p.name+' repaired a mechanical breakdown with the Station Wagon.');
 }
 s.step=p.openingTurn?'play':'draw';p.openingTurn=false;s.fresh=[];s.discardsLeft=0;
}
function finishStage(s){
 const ranked=[...s.players].sort((a,b)=>b.km-a.km||b.played.reduce((z,c)=>z+c.km,0)-a.played.reduce((z,c)=>z+c.km,0)||a.id-b.id);
 const best=ranked[0],bestRaw=best.played.reduce((z,c)=>z+c.km,0);
 const winners=ranked.filter(p=>p.km===best.km&&p.played.reduce((z,c)=>z+c.km,0)===bestRaw);
 const standings=ranked.map(p=>{
  const place=1+ranked.filter(q=>q.km>p.km||(q.km===p.km&&q.played.reduce((z,c)=>z+c.km,0)>p.played.reduce((z,c)=>z+c.km,0))).length;
  const winner=winners.some(q=>q.id===p.id);
  const banked=winner?2500:Math.min(2500,p.km);
  p.score+=banked;if(winner)p.wins++;
  return {id:p.id,name:p.name,place,km:p.km,rawKm:p.played.reduce((z,c)=>z+c.km,0),banked,total:p.score,winner};
 });
 s.results.push({leg:s.leg,standings,winners:winners.map(p=>p.id)});
 s.phase=s.leg===2?'finished':'between';s.step=null;s.fresh=[];
 log(s,LEGS[s.leg].name+' completed. '+winners.map(p=>p.name).join(' & ')+' banked 2,500 km.');
}
function finishPlayerTurn(s){
 const p=s.players[s.turn];if(p.hand.length>5)throw Error('Turn ended with more than five cards.');
 s.turns++;
 const next=(s.turn+1)%s.players.length;
 if(s.finishPending&&next===s.roundStart){finishStage(s);return;}
 s.turn=next;atStartOfTurn(s);
}
function takeCard(s,p,index,type){
 if(!Number.isInteger(index)||index<0||index>=p.hand.length||p.hand[index].type!==type)
  throw Error('Invalid card selection.');
 return p.hand.splice(index,1)[0];
}
function markFinish(s){if(s.players.some(p=>p.km>=2500))s.finishPending=true;}
function activatePower(s,p,card){
 if(card.type==='upgrade'){
  if(p.upgrades.some(u=>u.id===card.id))throw Error('That upgrade is already installed.');
  p.upgrades.push(card);
  log(s,p.name+' installed '+card.name+'.');
  return;
 }
 if(card.type!=='legendary')throw Error('Not a power card.');
 if(s.retiredLegendaries.includes(card.id))throw Error('Legendary has already been retired.');
 s.retiredLegendaries.push(card.id);
 if(card.id==='truck'){p.status=null;gain(p,100);}
 else if(card.id==='rodeo')p.shield+=2;
 else if(card.id==='shortcut'){gain(p,300);risky(s,p,500);}
 else if(card.id==='sunshine'){for(const driver of s.players)if(driver.status?.category==='weather')driver.status=null;gain(p,100);}
 log(s,p.name+' activated '+card.name+'.');
}
export function createChaosGame({names=['Driver 1','Driver 2'],seed=1}={}){
 if(!Array.isArray(names)||names.length<2||names.length>4||names.some(n=>typeof n!=='string'||!n.trim()||n.trim().length>24))
  throw Error('Provide 2–4 driver names, maximum 24 characters.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid shuffle seed.');
 if(new Set(names.map(n=>n.trim().toLocaleLowerCase())).size!==names.length)throw Error('Drivers need distinct names.');
 const s={version:2,seed:seed||1,serial:0,leg:0,phase:'playing',step:'play',
  turn:0,roundStart:0,turns:0,finishPending:false,discardsLeft:0,fresh:[],
  players:names.map((name,id)=>({id,name:name.trim(),km:0,score:0,hand:[],played:[],bonusKm:0,slowLoss:0,detourLoss:0,
   status:null,upgrades:[],used:[],shield:0,wins:0,openingTurn:true})),
  results:[],log:[],deck:[],discard:[],spent:[],retiredLegendaries:[],legendaryByLeg:[]};
 s.legendaryByLeg=distributeLegendaries(s);
 s.deck=regionalDeck(s);deal(s);atStartOfTurn(s);
 log(s,"Welcome to St. John's. Reach 2,500 km and finish the round!");
 return s;
}
export function takeChaosTurn(previous,{player,action,index=null,target=null,choice=null,useBoost=false}={}){
 if(previous?.version!==2||previous.phase!=='playing')throw Error('Race is not accepting turns.');
 const s=clone(previous),p=s.players[s.turn];
 if(player!==p.id)throw Error("Not this driver's turn.");
 if(s.step==='draw'){
  if(action!=='draw'||!['deck','discard'].includes(choice))throw Error('Choose how to draw to seven.');
  if(choice==='discard'&&!s.discard.length)throw Error('Discard pile is empty.');
  if(choice==='discard')p.hand.push(s.discard.pop());
  const count=choice==='deck'?2:1;
  for(let i=0;i<count;i++){const c=deckDraw(s);if(c)p.hand.push(c);}
  if(p.hand.length>7)throw Error('Draw exceeded seven cards.');
  s.fresh=p.hand.filter(c=>(c.type==='upgrade'||c.type==='legendary')).map(c=>c.uid)
   .filter(id=>!previous.players[previous.turn].hand.some(c=>c.uid===id));
  s.step='play';log(s,p.name+' drew to '+p.hand.length+' cards.');
  return s;
 }
 if(s.step==='discard'){
  if(action!=='discard')throw Error('Discard one card to finish your turn.');
  if(!Number.isInteger(index)||index<0||index>=p.hand.length)throw Error('Invalid discard selection.');
  s.discard.push(p.hand.splice(index,1)[0]);s.discardsLeft--;
  if(s.discardsLeft===0)finishPlayerTurn(s);
  return s;
 }
 if(s.step!=='play')throw Error('Invalid turn phase.');
 if(action==='power'){
  const c=p.hand[index];
  if(!c||!['upgrade','legendary'].includes(c.type))throw Error('Select a power card.');
  if(c.type==='upgrade'&&p.upgrades.some(u=>u.id===c.id))throw Error('That upgrade is already installed.');
  const free=s.fresh.includes(c.uid);
  const used=p.hand.splice(index,1)[0];
  s.fresh=s.fresh.filter(id=>id!==used.uid);
  activatePower(s,p,used);
  discardPlayed(s,used);
  if(free){
   const replacement=deckDraw(s);
   if(replacement){
    p.hand.push(replacement);
    if(['upgrade','legendary'].includes(replacement.type))s.fresh.push(replacement.uid);
   }
   markFinish(s);return s;
  }
 }else if(action==='drive'){
  if(p.status?.kind==='block')throw Error('Repair the breakdown before driving.');
  const c=takeCard(s,p,index,'mileage');
  p.played.push(c);
  if(p.status?.kind==='slow'){
   const lost=Math.min(c.km,p.status.amount);p.slowLoss+=lost;
   log(s,p.name+' slowed by '+p.status.name+' (-'+lost+' km).');p.status=null;
  }
  if(useBoost){
   const u=p.upgrades.find(u=>u.id==='shortcut-specialist'&&!p.used.includes(u.id));
   if(!u)throw Error('Shortcut boost unavailable.');
   p.used.push(u.id);p.bonusKm+=100;
  }
  refresh(p);risky(s,p,c.km);log(s,p.name+' drove '+c.km+' km.');
 }else if(action==='hazard'){
  const victim=s.players.find(q=>q.id===target);
  const c=p.hand[index];
  if(!victim||victim.id===p.id||!c||c.type!=='hazard'||!canTarget(victim,c))
   throw Error('Select an eligible opponent.');
  takeCard(s,p,index,'hazard');hit(s,victim,c);discardPlayed(s,c);
 }else if(action==='fix'){
  const c=p.hand[index];
  if(!c||c.type!=='fix'||(c.id!=='atlas'&&!canFix(p.status,c)))
   throw Error('This repair cannot be used right now.');
  takeCard(s,p,index,'fix');
  if(c.id==='atlas'){gain(p,150);log(s,p.name+' took a local shortcut (+150 km; detours remain permanent).');}
  else {log(s,p.name+' repaired '+p.status.name+'.');p.status=null;}
  discardPlayed(s,c);
 }else if(action==='recover'){
  if(!p.status)throw Error('No ongoing hazard to recover from.');
  log(s,p.name+' spent a turn clearing '+p.status.name+'.');p.status=null;
 }else if(action!=='pass')throw Error('Unsupported action.');
 markFinish(s);
 s.fresh=[];s.step='discard';s.discardsLeft=action==='pass'?2:1;
 return s;
}
export function advanceChaosLeg(previous){
 if(previous?.version!==2||previous.phase!=='between')throw Error('No completed stage to advance.');
 const s=clone(previous);s.leg++;s.phase='playing';s.roundStart=s.leg%s.players.length;
 s.turn=s.roundStart;s.finishPending=false;
 s.deck=regionalDeck(s);s.discard=[];s.spent=[];s.fresh=[];
 for(const p of s.players){
  p.km=0;p.hand=[];p.played=[];p.bonusKm=0;p.slowLoss=0;p.detourLoss=0;
  p.status=null;p.upgrades=[];p.used=[];p.shield=0;p.openingTurn=true;
 }
 deal(s);atStartOfTurn(s);
 log(s,'New region: '+LEGS[s.leg].name+'. All upgrades and active hazards reset.');
 return s;
}
export function chaosLeaders(s){
 const west=(p)=>s.results.find(r=>r.leg===2)?.standings.find(r=>r.id===p.id)?.banked||0;
 return [...s.players].sort((a,b)=>b.score-a.score||b.wins-a.wins||west(b)-west(a)||a.id-b.id);
}
export function chaosActionOptions(s){
 if(!s||s.version!==2||s.phase!=='playing')return [];
 if(s.step==='draw')return [{action:'draw',choice:'deck'},...(s.discard.length?[{action:'draw',choice:'discard'}]:[])];
 const p=s.players[s.turn];
 if(s.step==='discard')return p.hand.map((_,index)=>({action:'discard',index}));
 if(s.step!=='play')return [];
 const options=[];
 p.hand.forEach((c,index)=>{
  if(c.type==='mileage'&&p.status?.kind!=='block')options.push({action:'drive',index});
  if(c.type==='hazard')for(const victim of s.players)
   if(victim.id!==p.id&&canTarget(victim,c))options.push({action:'hazard',index,target:victim.id});
  if(c.type==='fix'&&(c.id==='atlas'||canFix(p.status,c)))options.push({action:'fix',index});
  if(['upgrade','legendary'].includes(c.type)&&!(c.type==='upgrade'&&p.upgrades.some(u=>u.id===c.id)))
   options.push({action:'power',index,free:s.fresh.includes(c.uid)});
 });
 if(p.status)options.push({action:'recover'});
 options.push({action:'pass'});
 return options;
}
