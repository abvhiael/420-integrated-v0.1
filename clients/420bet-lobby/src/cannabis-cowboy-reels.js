// Visual reel scheduler shared by base spins and Endless Harvest.
// 700 ms to first stop; 500 ms to reel 2; 750 ms between remaining columns.
export const REEL_STOP_DELAYS=Object.freeze([700,500,750,750,750,750]);
export const REEL_STOP_TIMES=Object.freeze(REEL_STOP_DELAYS.map((_,i)=>REEL_STOP_DELAYS.slice(0,i+1).reduce((a,b)=>a+b,0)));
const SYMBOL_KINDS=['bud','jar','guitar','vinyl','boots','horseshoe','papers','cole','smoke-wild','scatter','road-ticket'];
export function makeReelStrip(doc,seed=0){
 const mask=doc.createElement('span');mask.className='cc-reel-mask';mask.setAttribute('aria-hidden','true');
 const track=doc.createElement('span');track.className='cc-reel-track';
 // Repeat an identical six-symbol sequence, so the CSS track wraps without
 // a visible jump or the old rapid vibration at its loop boundary.
 for(let j=0;j<12;j++){
  const type=SYMBOL_KINDS[(seed+(j%6)*3)%SYMBOL_KINDS.length];
  const tile=doc.createElement('span');tile.className='cc-reel-token cc-symbol-'+type;
  const glyph=doc.createElement('span');glyph.className='cc-cell-glyph';
  glyph.textContent=['🌿','🫙','🎸','💿','👢','♧','▤','🤠','◎','🚌','🎫'][(seed+(j%6)*3)%SYMBOL_KINDS.length];
  tile.append(glyph);track.append(tile);
 }
 mask.append(track);return mask;
}
export function createReelSequence({doc,cells,board,locked=[],schedule,done,onStop=()=>{},reducedMotion=false}){
 if(!doc||cells?.length!==48||board?.length!==48||typeof schedule!=='function'||typeof done!=='function')throw Error('Invalid reel animation arguments');
 const lockedSet=new Set(locked),stopTimes=[],overlays=[];
 cells.forEach((cell,p)=>{
  if(lockedSet.has(p))return;
  cell.classList.add('cc-reel-rolling');
  const mask=makeReelStrip(doc,p%6);cell.append(mask);overlays.push([cell,mask]);
 });
 let reel=0,aborted=false;
 const step=()=>{
  if(aborted)return;
  const c=reel;
  for(let row=0;row<8;row++){
   const p=row*6+c,cell=cells[p];
   cell.classList.remove('cc-reel-rolling');
   const mask=cell.querySelector('.cc-reel-mask');if(mask)mask.remove();
  }
  stopTimes.push(REEL_STOP_TIMES[c]);
  onStop(c,stopTimes[c]);
  reel++;
  if(reel===6){done(stopTimes);return;}
  schedule(step,reducedMotion?0:REEL_STOP_DELAYS[reel]);
 };
 schedule(step,reducedMotion?0:REEL_STOP_DELAYS[0]);
 return {abort:()=>{aborted=true;for(const [cell,mask] of overlays){cell.classList.remove('cc-reel-rolling');mask.remove();}},stopTimes};
}
// Render individual neon connections along adjacent cells of qualifying clusters.
// Clusters are geometries, not fixed twenty-line paylines.
export function drawClusterPaths(doc,container,clusters){
 for(const existing of [...container.querySelectorAll('.cc-win-path')])existing.remove();
 let count=0;
 for(const cluster of clusters){
  const owned=new Set(cluster.positions),visited=new Set();
  const visit=[cluster.positions[0]];visited.add(visit[0]);
  while(visit.length){
   const cell=visit.shift(),col=cell%6,row=Math.floor(cell/6);
   const adjacent=[col<5?cell+1:-1,row<7?cell+6:-1,col>0?cell-1:-1,row>0?cell-6:-1];
   for(const next of adjacent){
    if(next<0||!owned.has(next)||visited.has(next))continue;
    visited.add(next);visit.push(next);
    const nc=next%6,nr=Math.floor(next/6);
    const segment=doc.createElement('span');segment.className='cc-win-path';segment.setAttribute('aria-hidden','true');
    const horizontal=nr===row;
    segment.classList.add(horizontal?'cc-path-horizontal':'cc-path-vertical');
    if(horizontal){
     segment.style.left=(Math.min(col,nc)+0.5)/6*100+'%';
     segment.style.top=(row+0.5)/8*100+'%';
     segment.style.width=100/6+'%';
    }else{
     segment.style.left=(col+0.5)/6*100+'%';
     segment.style.top=(Math.min(row,nr)+0.5)/8*100+'%';
     segment.style.height=100/8+'%';
    }
    container.append(segment);count++;
   }
  }
 }
 return count;
}
export function clearClusterPaths(container){for(const el of [...container.querySelectorAll('.cc-win-path')])el.remove();}
