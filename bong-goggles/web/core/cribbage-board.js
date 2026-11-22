// BC-1.4. The 120 scoring holes follow the two bands in the approved
// hole-free cannabis-leaf board image (1448 x 1086 pixels). Image and overlay
// use the same intrinsic viewBox; resizing cannot move a peg off its hole.
// The 3-player variant uses a visible virtual amber middle track. In 4-player
// cribbage the two opposite-seat teams share the two physical tracks.
export const CRIBBAGE_BOARD_SIZE=Object.freeze({width:1448,height:1086});
export const CRIBBAGE_BOARD_ART='/assets/games/cribbage/leaf-board.svg';
export const CRIBBAGE_TRACKS=Object.freeze(['green','ivory','amber']);
export const CRIBBAGE_FINISH=Object.freeze({x:704,y:893,number:121});

// Surveyed centerline control points through the two original color bands,
// ordered from the START to 120. Catmull-Rom + equal arc-length sampling
// produces exactly 12 groups of 10 holes, with no fabricated scoring steps.
const WAYPOINTS=Object.freeze([
 [680,838],[560,767],[427,727],[275,685],[155,657],[107,624],
 [103,577],[139,556],[242,572],[336,607],[388,600],[410,548],
 [390,492],[331,424],[274,359],[249,302],[267,277],[313,298],
 [399,389],[485,483],[556,507],[595,476],[614,418],[617,330],
 [625,245],[642,168],[689,117],[722,125],[754,210],[765,332],
 [771,426],[797,485],[852,518],[916,501],[998,426],[1099,316],
 [1160,276],[1192,296],[1186,347],[1129,420],[1072,477],
 [1038,536],[1080,561],[1157,555],[1274,554],[1345,547],
 [1366,571],[1331,610],[1242,649],[1117,684],[989,716],
 [860,757],[758,819],[732,873]
]);
const lerp=(a,b,t)=>a+(b-a)*t;
const catmull=(p0,p1,p2,p3,t)=>{
 const t2=t*t,t3=t2*t;
 return [
  .5*(2*p1[0]+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
  .5*(2*p1[1]+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
 ];
};
function survey(){
 const points=[];
 for(let i=0;i<WAYPOINTS.length-1;i++){
  const p0=WAYPOINTS[Math.max(0,i-1)],p1=WAYPOINTS[i],
        p2=WAYPOINTS[i+1],p3=WAYPOINTS[Math.min(WAYPOINTS.length-1,i+2)];
  for(let step=0;step<24;step++)points.push(catmull(p0,p1,p2,p3,step/24));
 }
 points.push(WAYPOINTS.at(-1));
 const distances=[0];
 for(let i=1;i<points.length;i++){
  const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1];
  distances.push(distances[i-1]+Math.hypot(dx,dy));
 }
 const length=distances.at(-1);
 const position=fraction=>{
  const target=Math.max(0,Math.min(length,fraction*length));
  let lo=1,hi=distances.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid]<target)lo=mid+1;else hi=mid;}
  const segment=distances[lo]-distances[lo-1];
  const t=segment>0?(target-distances[lo-1])/segment:0;
  return [lerp(points[lo-1][0],points[lo][0],t),lerp(points[lo-1][1],points[lo][1],t)];
 };
 const lanes={green:[],ivory:[],amber:[]};
 for(let n=1;n<=120;n++){
  const frac=n/120,[x,y]=position(frac);
  const before=position(Math.max(0,frac-.001)),after=position(Math.min(1,frac+.001));
  const dx=after[0]-before[0],dy=after[1]-before[1],scale=Math.hypot(dx,dy);
  if(scale<.001)throw Error('Invalid surveyed board tangent');
  // Green is the inner painted band, ivory the outer pale band.
  const nx=-dy/scale,ny=dx/scale;
  for(const [name,offset] of [['green',25],['ivory',-25],['amber',0]]){
   lanes[name].push(Object.freeze({
    x:Number((x+nx*offset).toFixed(3)),
    y:Number((y+ny*offset).toFixed(3)),number:n
   }));
  }
 }
 return Object.freeze(Object.fromEntries(
  Object.entries(lanes).map(([name,holes])=>[name,Object.freeze(holes)])));
}
export const CRIBBAGE_HOLES=survey();
export const CRIBBAGE_PARKS=Object.freeze({
 green:Object.freeze([{x:447,y:783},{x:487,y:783}]),
 ivory:Object.freeze([{x:447,y:822},{x:487,y:822}]),
 amber:Object.freeze([{x:447,y:804},{x:487,y:804}])
});
export function cribbageHole(lane,score,peg=0){
 if(!CRIBBAGE_TRACKS.includes(lane)||!Number.isInteger(score)||score<0)return null;
 if(score===0)return CRIBBAGE_PARKS[lane][peg===1?1:0];
 if(score>=121)return CRIBBAGE_FINISH;
 return CRIBBAGE_HOLES[lane][score-1];
}
export function cribbageTeams(seatCount){
 if(seatCount===2)return Object.freeze([0,1]);
 if(seatCount===3)return Object.freeze([0,1,2]);
 if(seatCount===4)return Object.freeze([0,1,0,1]);
 throw Error('Unsupported cribbage seat count');
}
export function cribbageLane(team,seatCount){
 if(!Number.isInteger(team)||team<0||team>2)return null;
 return (seatCount===3?['green','ivory','amber']:['green','ivory'])[team]??null;
}
export function cribbageNewPegs(scores,seatCount){
 const mapping=cribbageTeams(seatCount);
 const pegs=[];
 for(let team=0;team<new Set(mapping).size;team++){
  const n=mapping.findIndex(x=>x===team);
  const score=Math.min(121,Math.max(0,Number(scores?.[n])||0));
  pegs.push(Object.freeze({team,score,back:'a',a:score,b:score,hop:null}));
 }
 return Object.freeze(pegs);
}
// Move ONLY the rear physical peg ahead of the front one. The previous front
// becomes rear after the score; individual peg identity never swaps.
export function cribbageLeap(pegs,team,total){
 if(!Array.isArray(pegs)||!Number.isInteger(team)||!Number.isFinite(total)||total<0)return pegs;
 const next=pegs.map(p=>{
  if(p.team!==team)return p;
  const score=Math.min(121,Math.trunc(total));
  if(score<=p.score)return p;
  const key=p.back,old=p[key],other=key==='a'?'b':'a';
  return Object.freeze({...p,[key]:score,score,back:other,
   hop:Object.freeze({peg:key,from:old,to:score})});
 });
 return Object.freeze(next);
}
export function cribbageSettlePegs(pegs){
 return Object.freeze(pegs.map(p=>p.hop?Object.freeze({...p,hop:null}):p));
}
