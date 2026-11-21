// CCC-ART-6: browser-only SVG playback. Exact route points remain authoritative in
// chaos-board.js. Animations are overlays on already-settled game state.
import {chaosRoutePosition} from './chaos-board.js';

const round=n=>Math.round(n*100)/100;
export function chaosMotionFrames(region,from,to,seat,count){
 if(!Number.isFinite(from)||!Number.isFinite(to)||!Number.isInteger(seat)||
  !Number.isInteger(count)||count<2||count>4||seat<0||seat>=count)
  throw Error('Invalid cosmetic vehicle motion.');
 const steps=Math.min(28,Math.max(2,Math.ceil(Math.abs(to-from)/75)));
 const offset=(seat-(count-1)/2)*15;
 return Object.freeze(Array.from({length:steps+1},(_,i)=>{
  const pos=chaosRoutePosition(region,from+(to-from)*i/steps);
  const rad=pos.angle*Math.PI/180;
  return Object.freeze({x:round(pos.x-Math.sin(rad)*offset),
   y:round(pos.y+Math.cos(rad)*offset),angle:pos.angle});
 }));
}
export function playChaosMotion(root,effects,game,{reducedMotion=false}={}){
 if(reducedMotion||!root||!effects?.moves?.length||!game?.players||
  !['east','ontario','west'].includes(['east','ontario','west'][game.leg]))return 0;
 const doc=root.ownerDocument;
 if(!doc?.createElementNS)return 0;
 let count=0;
 for(const move of effects.moves){
  const seat=game.players.findIndex(p=>p.id===move.id);
  if(seat<0||move.from===move.to)continue;
  const group=root.querySelector('.ccc-map-vehicle--'+seat);
  const orientation=group?.querySelector('.ccc-vehicle-direction');
  if(!group||!orientation)continue;
  const frames=chaosMotionFrames(['east','ontario','west'][game.leg],move.from,move.to,seat,game.players.length);
  const dur=(Math.min(1.35,Math.max(.35,Math.abs(move.to-move.from)/650))).toFixed(2)+'s';
  const append=(target,type,values)=>{
   const node=doc.createElementNS('http://www.w3.org/2000/svg','animateTransform');
   for(const [name,val] of Object.entries({
    attributeName:'transform',attributeType:'XML',type,values,dur,
    begin:'0s',fill:'remove',calcMode:'linear'}))node.setAttribute(name,val);
   target.appendChild(node);
  };
  // Animate the native SVG coordinate transform, never CSS pixel offsets:
  // board scales remain correct on phones and retina displays.
  append(group,'translate',frames.map(f=>f.x+' '+f.y).join(';'));
  append(orientation,'rotate',frames.map(f=>String(f.angle)).join(';'));
  count++;
 }
 return count;
}
