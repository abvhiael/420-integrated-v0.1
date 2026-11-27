// Draw moving pegs over the exact 1448x1086 user-supplied board image.
// The image already has all holes, numbers, start and finishing marks.
export const CRIBBAGE_BOARD_SIZE=Object.freeze({width:1448,height:1086});
export const CRIBBAGE_BOARD_ART='/assets/games/cribbage/board-cannabis-leaf.png';
export const CRIBBAGE_TRACKS=Object.freeze(['green','ivory','amber']);
export const CRIBBAGE_FINISH=Object.freeze({x:723,y:916,number:121});

// Peg interpolation retains the qualified ordinal scoring map.
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
// Measured centres from the 1448 x 1086 supplied artwork. The amber lane is
// a virtual third-player lane only; no physical amber holes exist in the PNG.
const measured=points=>Object.freeze(points.map(([x,y],i)=>Object.freeze({x,y,number:i+1})));
export const CRIBBAGE_HOLES=Object.freeze({green:measured([[704,864],[689,833],[666,805],[646,780],[621,761],[594,745],[568,732],[539,723],[510,714],[478,708],[398,695],[371,689],[344,685],[316,678],[292,670],[264,664],[240,655],[211,644],[186,632],[162,612],[197,585],[226,589],[253,597],[290,605],[329,612],[369,608],[407,597],[426,572],[425,536],[400,497],[346,436],[321,407],[299,378],[281,356],[268,324],[290,306],[324,324],[346,343],[367,371],[389,400],[439,474],[467,501],[490,524],[516,537],[542,546],[568,546],[596,538],[618,524],[637,504],[647,478],[649,411],[650,377],[649,347],[649,317],[651,284],[654,255],[659,228],[665,202],[678,180],[697,159],[747,160],[764,182],[780,207],[786,237],[792,260],[793,286],[793,316],[793,346],[791,377],[793,407],[797,475],[811,501],[833,527],[859,540],[895,545],[925,539],[953,521],[972,504],[991,485],[1015,457],[1062,394],[1084,367],[1108,342],[1131,322],[1153,305],[1177,322],[1164,353],[1145,380],[1128,405],[1105,432],[1042,497],[1023,532],[1013,562],[1031,598],[1070,614],[1105,618],[1137,614],[1168,607],[1203,600],[1240,591],[1271,622],[1245,640],[1219,651],[1189,660],[1164,668],[1138,676],[1112,682],[1081,689],[1054,694],[1024,698],[940,710],[910,717],[881,727],[856,738],[833,751],[805,770],[785,790],[768,811],[754,834],[739,863]]),ivory:measured([[679,877],[662,850],[644,827],[621,805],[595,785],[573,774],[548,763],[524,755],[499,750],[474,745],[391,737],[359,731],[327,724],[298,718],[259,709],[226,696],[199,684],[171,668],[144,649],[120,626],[143,548],[177,546],[207,546],[237,553],[263,560],[295,567],[321,572],[349,572],[374,555],[369,526],[319,462],[293,431],[267,393],[244,355],[231,305],[263,271],[309,275],[345,297],[381,332],[419,376],[461,428],[475,446],[490,463],[503,480],[517,494],[534,505],[558,508],[580,499],[595,485],[604,464],[604,414],[603,380],[601,341],[599,307],[603,265],[610,235],[621,204],[633,177],[652,147],[685,121],[762,122],[790,148],[812,184],[824,214],[834,248],[839,281],[838,316],[838,346],[835,377],[837,409],[840,468],[847,489],[865,501],[886,507],[906,498],[924,487],[938,473],[954,460],[970,443],[983,425],[1031,357],[1066,322],[1091,300],[1135,273],[1175,268],[1215,304],[1207,351],[1186,391],[1159,426],[1134,457],[1082,518],[1062,547],[1080,570],[1111,578],[1139,575],[1168,569],[1202,561],[1228,554],[1268,547],[1304,550],[1318,631],[1282,663],[1247,682],[1216,695],[1189,706],[1157,715],[1124,722],[1089,730],[1061,734],[1031,740],[949,754],[926,759],[901,765],[878,773],[853,783],[830,797],[811,815],[793,834],[777,856],[765,879]]),amber:survey().amber});
export const CRIBBAGE_PARKS=Object.freeze({
 green:Object.freeze([{x:460,y:804},{x:498,y:804}]),
 ivory:Object.freeze([{x:460,y:842},{x:498,y:842}]),
 amber:Object.freeze([{x:460,y:822},{x:498,y:822}])
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
