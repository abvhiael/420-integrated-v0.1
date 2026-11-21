// CCC-4 — local, deterministic computer drivers. The canonical CCC-1 engine owns every move.
// Decisions use only the active driver's hand, the public discard top and public opponents;
// they never inspect stock order, seeds, hidden rival cards, Wallet or external state.
import {chaosActionOptions,canFix,takeChaosTurn} from './cross-country-chaos.js';

export const CHAOS_COMPUTER_LEVELS=Object.freeze(['easy','normal','hard']);
const allowed=new Set(CHAOS_COMPUTER_LEVELS);
export const isChaosComputer=player=>Boolean(player?.controller==='computer'&&allowed.has(player.difficulty));
export function configureChaosComputerSeats(game,controls){
 if(game?.version!==2||game.phase!=='playing'||game.leg!==0||game.turns!==0||
    !Array.isArray(controls)||controls.length!==game.players?.length||
    controls.some(x=>x!=='human'&&!allowed.has(x))||!controls.includes('human'))
  throw Error('Choose 2–4 driver controllers with at least one human.');
 const configured=structuredClone(game);
 for(let i=0;i<configured.players.length;i++){
  const level=controls[i];
  configured.players[i].controller=level==='human'?'human':'computer';
  configured.players[i].difficulty=level==='human'?null:level;
 }
 return configured;
}
const active=(s)=>s.players[s.turn];
const seedMix=(s,index=0)=>{
 // A repeatable, local choice independent of the hidden deck RNG state.
 let a=(Math.imul((s.turns+1)>>>0,2654435761)^
  Math.imul((s.leg+1)>>>0,2246822519)^
  Math.imul((active(s).id+1)>>>0,3266489917)^
  Math.imul(index+1,668265263))>>>0;
 a^=a>>>16;a=Math.imul(a,2246822507);a^=a>>>13;
 return (a>>>0)/4294967296;
};
const cardValue=(c,p,s,hard=false)=>{
 if(!c)return -1000;
 if(c.type==='mileage')return c.km-(c.km>300?(hard?170:90):0)+
  (p.status?.kind==='block'?-80:0);
 if(c.type==='fix')return c.id==='atlas'?200:
  canFix(p.status,c)?(p.status?.kind==='block'?800:300):30;
 if(c.type==='upgrade')return p.upgrades.some(u=>u.id===c.id)?-200:hard?330:255;
 if(c.type==='legendary')return hard?360:300;
 if(c.type==='hazard'){
  const targets=s.players.filter(q=>q.id!==p.id);
  const viable=targets.some(q=>c.kind==='detour'||!q.status);
  return viable?(hard?165:130):0;
 }
 return -100;
};
const readyBoost=p=>p.upgrades.some(u=>u.id==='shortcut-specialist'&&!p.used.includes(u.id));
const wouldBoost=(s,c,p,level)=>level==='hard'?
 (s.finishPending||p.km>=1100||p.km+c.km+100>=2500):
 (p.km>=1650||s.finishPending||p.km+c.km+100>=2500);
const publicDefense=(victim,card)=>Boolean(victim.shield>0||
 victim.upgrades.some(u=>!victim.used.includes(u.id)&&
   u.id!=='station-wagon'&&u.id!=='shortcut-specialist'&&
   (u.category===card.category||u.category==='all')));
const targetThreat=(s,p,target)=>{
 const highest=Math.max(...s.players.filter(q=>q.id!==p.id).map(q=>q.km));
 return (target.km===highest?110:0)+target.km/6+
  (target.km>=2000?250:target.km>=1500?100:0)+
  (target.score>p.score?80:0);
};
function grade(s,option,hard){
 const p=active(s),card=p.hand[option.index],level=hard?'hard':'normal';
 if(option.action==='draw'){
  if(option.choice==='deck')return 225;
  const top=s.discard.at(-1);
  const value=cardValue(top,p,s,hard);
  return Math.max(-150,value)+(top?.type==='fix'&&canFix(p.status,top)?230:0)-
   (hard?65:45);
 }
 if(option.action==='discard'){
  // Discard the least useful card; evaluate only the owner's hand.
  const duplicates=p.hand.filter(c=>c.type==='mileage'&&c.km===card?.km).length;
  return 500-cardValue(card,p,s,hard)+(duplicates>2?30:0);
 }
 if(option.action==='pass')return -600;
 if(option.action==='recover')return p.status?.kind==='block'?570:170;
 if(option.action==='fix'){
  if(card.id==='atlas')return hard?280:210;
  return p.status?.kind==='block'?1100:hard?255:230;
 }
 if(option.action==='power'){
  if(option.free)return 2000;
  if(card.type==='upgrade')return s.finishPending?65:(hard?440:320);
  if(card.id==='truck')return p.status?.kind==='block'?1020:250;
  if(card.id==='rodeo')return p.shield===0?(hard?430:360):130;
  if(card.id==='shortcut')return hard?400:490;
  if(card.id==='sunshine')return p.status?.category==='weather'?700:230;
  return 210;
 }
 if(option.action==='drive'){
  const loss=p.status?.kind==='slow'?Math.min(card.km,p.status.amount):0;
  const bonus=readyBoost(p)&&wouldBoost(s,card,p,level)?100:0;
  const effective=Math.max(0,card.km-loss)+bonus;
  const finish=effective+p.km>=2500?1200:0;
  const risky=card.km>300?(hard?175:105):0;
  return effective-risky+finish+(s.finishPending?150:0);
 }
 if(option.action==='hazard'){
  const victim=s.players.find(q=>q.id===option.target);
  if(!victim)return -1000;
  const protection=publicDefense(victim,card)?(hard?650:250):0;
  const threat=targetThreat(s,p,victim);
  const effect=card.kind==='detour'?Math.min(victim.km,card.amount||0):
   card.kind==='block'?280:Math.min(150,card.amount||0);
  return (hard?70:20)+effect+(hard?threat:threat/2)-protection-
   (s.finishPending&&victim.km<1800?150:0);
 }
 return -1000;
}
export function chooseChaosComputerMove(s){
 if(s?.version!==2||s.phase!=='playing'||!isChaosComputer(active(s)))
  throw Error('Current driver is not a valid computer opponent.');
 const choices=chaosActionOptions(s);
 if(!choices.length)throw Error('Computer has no legal move.');
 const p=active(s),level=p.difficulty;
 let pick;
 if(level==='easy'){
  // Easy makes deliberately imperfect but always legal choices and cannot see future cards.
  const choicesOther=choices.filter(o=>o.action!=='pass');
  const set=choicesOther.length&&seedMix(s,choices.length)>.14?choicesOther:choices;
  pick=set[Math.floor(seedMix(s,4)*set.length)];
  if(s.step==='discard')pick=choices[Math.floor(seedMix(s,3)*choices.length)];
 }else{
  const hard=level==='hard';
  pick=choices.reduce((best,option)=>{
   if(!best)return option;
   const a=grade(s,option,hard),b=grade(s,best,hard);
   return a>b?option:best;
  },null);
 }
 // Strip heuristic-only fields. The engine still validates player, phase, index and target.
 const {action,index,choice,target}=pick;
 const result={action};
 if(Number.isInteger(index))result.index=index;
 if(choice)result.choice=choice;
 if(Number.isInteger(target))result.target=target;
 if(action==='drive'&&level!=='easy'&&readyBoost(p)&&wouldBoost(s,p.hand[index],p,level))
  result.useBoost=true;
 return Object.freeze(result);
}
export function advanceChaosComputerTurns(initial,{maxActions=96}={}){
 if(!Number.isInteger(maxActions)||maxActions<1||maxActions>1024)
  throw Error('Invalid computer action limit.');
 if(initial?.version!==2)throw Error('Invalid Cross-Country Chaos game.');
 let game=initial,lastBefore=null,lastMove=null;
 const moves=[];
 while(game.phase==='playing'&&isChaosComputer(game.players[game.turn])&&moves.length<maxActions){
  const move=chooseChaosComputerMove(game);
  const old=game;
  const next=takeChaosTurn(old,{player:old.players[old.turn].id,...move});
  if(next===old)throw Error('Computer move made no progress.');
  game=next;lastBefore=old;lastMove=move;moves.push(move);
 }
 return Object.freeze({game,moves:Object.freeze(moves),lastBefore,lastMove,
  pending:game.phase==='playing'&&isChaosComputer(game.players[game.turn])});
}
