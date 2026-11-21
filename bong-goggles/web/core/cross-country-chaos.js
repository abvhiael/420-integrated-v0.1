// Cross-Country Chaos: local pass-and-play rules. Zero wagers, no wallet or network authority.
export const LEGS=Object.freeze([
 {id:'east',name:'The Down East Disaster',from:"St. John's",to:'Montréal',target:2200},
 {id:'ontario',name:'The Never-Ending Ontario',from:'Montréal',to:'Kenora',target:2100},
 {id:'west',name:'Prairie Madness & Mountain Mayhem',from:'Kenora',to:'Vancouver',target:2700}
]);
export const MILEAGE_VALUES=Object.freeze([100,150,200,250,300,400,500]);
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
 {id:'station-wagon',name:'The Indestructible Station Wagon',category:'mechanical',description:'Negate one mechanical hazard each leg.'},
 {id:'thermos',name:'Bottomless Thermos',category:'all',description:'Negate one hazard of any type each leg.'},
 {id:'shortcut-specialist',name:'Shortcut Specialist',category:'boost',description:'Add 100 km to one drive each leg.'}
]);
export const LEGENDARIES=Object.freeze([
 {id:'truck',name:'A Guy I Know Has a Truck',description:'Clear your hazard and advance 100 km.'},
 {id:'rodeo',name:'Not My First Rodeo',description:'Negate the next two hazards aimed at you.'},
 {id:'shortcut',name:'Trust Me, I Know a Shortcut',description:'Advance 300 km and face one regional hazard.'},
 {id:'sunshine',name:'Would You Look at That!',description:'Clear every active weather hazard; advance 100 km.'}
]);
const MILEAGE_PRINT=[100,100,100,100,100,100,150,150,150,150,150,150,200,200,200,200,200,250,250,250,250,300,300,300,300,400,400,400,500,500];
const clone=x=>JSON.parse(JSON.stringify(x));
function roll(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
function shuffled(s,items){const result=items.map(clone);for(let i=result.length-1;i>0;i--){const j=Math.floor(roll(s)*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function makeDeck(s,type){
 if(type==='mileage')return shuffled(s,MILEAGE_PRINT.map(km=>({type:'mileage',km})));
 if(type==='chaos')return shuffled(s,[...HAZARDS[LEGS[s.leg].id].map(x=>({...x,type:'hazard'})),...FIXES.flatMap(x=>[{...x,type:'fix'},{...x,type:'fix'}])]);
 if(type==='power')return shuffled(s,UPGRADES);
 throw new Error('unknown deck');
}
function draw(s,type){if(!s.decks[type].length)s.decks[type]=makeDeck(s,type);return s.decks[type].pop();}
function drawLegendary(s){if(!s.decks.legendary.length)s.decks.legendary=shuffled(s,LEGENDARIES);return s.decks.legendary.pop();}
function deal(s,p){for(let i=0;i<3;i++)p.hand.push(draw(s,'mileage'));for(let i=0;i<2;i++)p.hand.push(draw(s,'chaos'));}
function log(s,message){s.log.unshift(message);s.log=s.log.slice(0,18);}
export function createChaosGame({names=['Driver 1','Driver 2'],seed=1}={}){
 if(!Array.isArray(names)||names.length<2||names.length>4||names.some(n=>typeof n!=='string'||!n.trim()||n.trim().length>24))throw new Error('Provide 2–4 driver names, maximum 24 characters.');
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid shuffle seed.');
 if(new Set(names.map(n=>n.trim().toLocaleLowerCase())).size!==names.length)throw new Error('Drivers need distinct names.');
 const s={version:1,seed:seed||1,leg:0,phase:'playing',turn:0,turns:0,players:names.map((n,i)=>({id:i,name:n.trim(),km:0,points:0,hand:[],status:null,upgrades:[],used:[],legendary:null,shield:0,wins:0})),results:[],log:[],decks:{mileage:[],chaos:[],power:[],legendary:[]}};
 s.decks.mileage=makeDeck(s,'mileage');s.decks.chaos=makeDeck(s,'chaos');s.decks.power=makeDeck(s,'power');s.decks.legendary=shuffled(s,LEGENDARIES);
 for(const p of s.players){p.upgrades.push(draw(s,'power'));p.legendary=drawLegendary(s);deal(s,p);}
 log(s,'Welcome to St. John\'s. The cross-country chaos begins!');
 return s;
}
export function canFix(status,fix){return Boolean(status&&fix&&fix.type==='fix'&&(fix.category===status.category||fix.category==='all'));}
function protectedBy(s,p,hazard){
 if(p.shield>0){p.shield--;log(s,p.name+' avoided '+hazard.name+' (Not My First Rodeo).');return true;}
 const upgrade=p.upgrades.find(u=>(u.category===hazard.category||u.category==='all')&&!p.used.includes(u.id));
 if(upgrade){p.used.push(upgrade.id);log(s,p.name+' avoided '+hazard.name+' using '+upgrade.name+'.');return true;}
 return false;
}
function hit(s,p,hazard){
 if(protectedBy(s,p,hazard))return;
 if(hazard.kind==='detour'){p.km=Math.max(0,p.km-hazard.amount);log(s,p.name+': '+hazard.name+' (-'+hazard.amount+' km).');return;}
 if(p.status){log(s,p.name+' already has a road hazard. The new '+hazard.name+' had no extra effect.');return;}
 p.status=clone(hazard);log(s,p.name+' hit by '+hazard.name+'.');
}
function risky(s,p,km){
 if(km<=300)return;
 const hazards=HAZARDS[LEGS[s.leg].id];
 const hazard=hazards[Math.floor(roll(s)*hazards.length)];
 log(s,p.name+' pushed their luck driving '+km+' km.');
 hit(s,p,hazard);
}
function removeCard(p,index,type){
 if(!Number.isInteger(index)||index<0||index>=p.hand.length||p.hand[index].type!==type)throw new Error('Invalid card selection.');
 return p.hand.splice(index,1)[0];
}
function finishLeg(s){
 const ranked=[...s.players].sort((a,b)=>b.km-a.km||a.id-b.id);
 const standings=ranked.map(p=>{const place=1+ranked.filter(q=>q.km>p.km).length;const earned=[5,3,2,1][place-1];p.points+=earned;if(place===1)p.wins++;return {id:p.id,name:p.name,place,km:p.km,earned,total:p.points};});
 s.results.push({leg:s.leg,standings});
 s.phase=s.leg===2?'finished':'between';
 log(s,LEGS[s.leg].name+' completed. '+ranked[0].name+' reached the finish line!');
}
function refill(s,p){
 p.hand.push(draw(s,'mileage'),draw(s,'chaos'));
 while(p.hand.length>9)p.hand.shift();
}
export function takeChaosTurn(previous,{player,action,index=null,target=null,useBoost=false}={}){
 if(previous?.version!==1||previous.phase!=='playing')throw new Error('Race is not accepting turns.');
 const s=clone(previous),p=s.players[s.turn];
 if(player!==p.id)throw new Error('Not this driver\'s turn.');
 if(!['drive','hazard','fix','recover','legendary','pass'].includes(action))throw new Error('Unsupported action.');
 if(action==='drive'){
  if(p.status?.kind==='block')throw new Error('Repair the breakdown before driving.');
  const card=removeCard(p,index,'mileage');
  let km=card.km;
  if(p.status?.kind==='slow'){km=Math.max(0,km-p.status.amount);log(s,p.name+' slowed by '+p.status.name+'.');p.status=null;}
  if(useBoost){const u=p.upgrades.find(x=>x.id==='shortcut-specialist');if(!u||p.used.includes(u.id))throw new Error('Shortcut boost unavailable.');p.used.push(u.id);km+=100;}
  p.km+=km;log(s,p.name+' drove '+km+' km.');
  risky(s,p,card.km);
 } else if(action==='hazard'){
  const victim=s.players.find(q=>q.id===target);
  if(!victim||victim.id===p.id||victim.status)throw new Error('Select an opponent without an active hazard.');
  const card=removeCard(p,index,'hazard');
  hit(s,victim,card);
 } else if(action==='fix'){
  const card=p.hand[index];if(!canFix(p.status,card))throw new Error('This fix does not match your current hazard.');
  removeCard(p,index,'fix');log(s,p.name+' repaired '+p.status.name+' using '+card.name+'.');p.status=null;
 } else if(action==='recover'){
  if(!p.status)throw new Error('No active hazard to recover from.');
  log(s,p.name+' spent a turn clearing '+p.status.name+'.');p.status=null;
 } else if(action==='legendary'){
  if(!p.legendary)throw new Error('No legendary card available.');
  const id=p.legendary.id;
  p.legendary=null;
  if(id==='truck'){p.status=null;p.km+=100;log(s,p.name+' called a guy with a truck (+100 km).');}
  if(id==='rodeo'){p.shield+=2;log(s,p.name+' gained two hazard shields.');}
  if(id==='shortcut'){p.km+=300;log(s,p.name+' took the sketchy shortcut (+300 km).');risky(s,p,500);}
  if(id==='sunshine'){for(const driver of s.players)if(driver.status?.category==='weather')driver.status=null;p.km+=100;log(s,p.name+' cleared the weather (+100 km).');}
 } else log(s,p.name+' took a pit stop.');
 s.turns++;
 if(s.players.some(q=>q.km>=LEGS[s.leg].target))finishLeg(s);
 else {refill(s,p);s.turn=(s.turn+1)%s.players.length;}
 return s;
}
export function advanceChaosLeg(previous){
 if(previous?.version!==1||previous.phase!=='between')throw new Error('No completed leg to advance.');
 const s=clone(previous);s.leg++;s.phase='playing';s.turn=s.leg%s.players.length;s.decks.mileage=makeDeck(s,'mileage');s.decks.chaos=makeDeck(s,'chaos');
 for(const p of s.players){
  p.km=0;p.status=null;p.shield=0;p.used=[];p.hand=[];
  if(s.leg===1&&p.upgrades.length<2){let choice=draw(s,'power');while(p.upgrades.some(u=>u.id===choice.id))choice=draw(s,'power');p.upgrades.push(choice);}
  deal(s,p);
 }
 log(s,'Onward to '+LEGS[s.leg].name+'! Permanent upgrades recharged; legends carried over.');
 return s;
}
export function chaosLeaders(s){return [...s.players].sort((a,b)=>b.points-a.points||b.wins-a.wins||b.km-a.km);}
export function chaosActionOptions(s){
 if(!s||s.phase!=='playing')return [];
 const p=s.players[s.turn];const actions=[];
 p.hand.forEach((c,i)=>{
  if(c.type==='mileage'&&p.status?.kind!=='block')actions.push({action:'drive',index:i});
  if(c.type==='hazard'&&s.players.some(q=>q.id!==p.id&&!q.status))actions.push({action:'hazard',index:i});
  if(canFix(p.status,c))actions.push({action:'fix',index:i});
 });
 if(p.status)actions.push({action:'recover'});
 if(p.legendary)actions.push({action:'legendary'});
 actions.push({action:'pass'});
 return actions;
}
