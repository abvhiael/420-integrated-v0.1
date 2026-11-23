// BC-2.4 original-board acceptance. Unlike the 652-point *unordered* survey,
// the complete peg path must follow the physical artwork and printed guides.
// Missing / approximate data fail this release check; don't synthesize holes.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {LABYRINTH_HOLE_CENTERS as holes,LABYRINTH_BOARD_SHA256} from '../core/labyrinth-hole-survey.js';
import {LABYRINTH_PRINTED_GUIDES} from '../core/labyrinth-printed-guides.js';
const root=resolve(import.meta.dirname,'..');
const fail=msg=>{throw Error('BC-2.4 original board peg-map qualification: '+msg)};
const art=resolve(root,'assets/games/labyrinth-cribbage/labyrinth.png');
const binary=await readFile(art).catch(()=>fail('approved original PNG absent'));
// The creator approved the GitHub-uploaded PNG independently of the earlier
// survey export's binary encoding. Pin its committed Git object identity.
const blobSHA=createHash('sha1').update('blob '+binary.length+'\0').update(binary).digest('hex');
if(blobSHA!=='db3f4e88a87bdb1ce9c6f202484bacfbb653cdc2')
 fail('the GitHub-approved board file was changed or replaced');
const source=resolve(root,'core/labyrinth-peg-map.json');
const raw=await readFile(source,'utf8').catch(()=>fail('exact numbered 0–325 track atlas is absent'));
let atlas;try{atlas=JSON.parse(raw)}catch{fail('invalid track atlas JSON')}
if(!atlas||typeof atlas!=='object'||Object.keys(atlas).sort().join(',')!==
 'artSHA256,guideAnchors,schemaVersion,scoreTarget,tracks'||
 atlas.schemaVersion!==1||atlas.scoreTarget!==325||
 atlas.artSHA256!==LABYRINTH_BOARD_SHA256||
 !Array.isArray(atlas.tracks)||atlas.tracks.length!==2||
 holes.length!==652)fail('incompatible original art/track schema');
const all=new Set();
for(const [trackNum,track] of atlas.tracks.entries()){
 if(!Array.isArray(track)||track.length!==326)fail('track '+trackNum+' must contain score positions 0 through 325');
 for(const [score,index] of track.entries()){
  if(!Number.isInteger(index)||index<0||index>=652||all.has(index))
   fail('duplicate, missing or foreign hole index at track '+trackNum+' score '+score);
  all.add(index);
  if(score===0&&holes[index].y<945)fail('start peg does not align with source start');
  if(score>0){
   const a=holes[track[score-1]],b=holes[index];
   const length=Math.hypot(a.x-b.x,a.y-b.y);
   if(length>120)fail('path jumps across unrelated maze segments, score '+score+' track '+trackNum);
  }
 }
}
if(all.size!==652)fail('not all physically observed holes were assigned');
const targets=Array.from({length:32},(_,i)=>(i+1)*10);
if(!atlas.guideAnchors||typeof atlas.guideAnchors!=='object'||
 Object.keys(atlas.guideAnchors).length!==targets.length)fail('printed guide anchors 10–320 incomplete');
for(const n of targets){
 const guide=atlas.guideAnchors[String(n)];
 const print=LABYRINTH_PRINTED_GUIDES[n];
 if(!print)fail('independent original-art printed numeral '+n+' is not surveyed');
 if(!Array.isArray(guide)||guide.length!==2||
  !guide.every(p=>p&&Number.isInteger(p.x)&&p.x>=0&&p.x<1254&&
   Number.isInteger(p.y)&&p.y>=0&&p.y<1254))
  fail('printed numeric guide '+n+' missing mapped image location');
 if(guide.some(p=>Math.hypot(p.x-print[0],p.y-print[1])>90))
  fail('guide '+n+' does not match independently surveyed printed location');
 // Numeric labels are printed alongside a stretch of up to four adjacent
 // score holes, not centered on the exact n-th physical hole.
 for(const track of atlas.tracks){
  const hole=holes[track[n]];
  if(Math.hypot(hole.x-print[0],hole.y-print[1])>135)
   fail('number '+n+' track is disconnected from its printed decade');
  let near=Infinity;
  for(let delta=-4;delta<=4;delta++){
   const at=n+delta;
   if(at<0||at>325)continue;
   const p=holes[track[at]];
   near=Math.min(near,Math.hypot(p.x-print[0],p.y-print[1]));
  }
  if(near>60)fail('number '+n+' does not border its real printed numeral');
 }
}
// Check segment topology at the actual surveyed coordinates. A nearest-neighbour
// chain that jumps between carved lanes must fail even when all 652 holes appear.
const crossing=(a,b,c,d)=>{
 const orient=(u,v,w)=>(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
 return orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0;
};
for(let lane=0;lane<2;lane++){
 const path=atlas.tracks[lane],other=atlas.tracks[1-lane];
 for(let i=0;i<325;i++){
  const a=holes[path[i]],b=holes[path[i+1]];
  for(let j=i+2;j<325;j++)
   if(crossing(a,b,holes[path[j]],holes[path[j+1]]))
    fail('self-crossing at lane '+lane+', score '+i+'/'+j);
  if(lane===0)for(let j=0;j<325;j++)
   if(crossing(a,b,holes[other[j]],holes[other[j+1]]))
    fail('physical rails cross near score '+i+'/'+j);
 }
}
// Manual visual validation of source numerals and path direction remains mandatory:
// this script does not OCR or infer guide labels from pixels.
console.log('BC-2.4 exact-art physical hole atlas structure passed:',all.size,'original centers,',targets.length,'number anchors');
