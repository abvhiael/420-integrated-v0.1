// BC-2.4 peg overlay: only a validated, numbered physical hole atlas may
// drive a peg. The unsequenced survey is never interpreted as score order.
import {LABYRINTH_HOLE_CENTERS,LABYRINTH_HOLE_COUNT,LABYRINTH_BOARD_SHA256} from './labyrinth-hole-survey.js';
import {LABYRINTH_PRINTED_GUIDES} from './labyrinth-printed-guides.js';

const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function validateLabyrinthPegAtlas(atlas){
 if(!atlas||typeof atlas!=='object'||Array.isArray(atlas)||
    atlas.schemaVersion!==1||atlas.scoreTarget!==325||
    atlas.artSHA256!==LABYRINTH_BOARD_SHA256||
    !Array.isArray(atlas.tracks)||atlas.tracks.length!==2||
    LABYRINTH_HOLE_CENTERS.length!==LABYRINTH_HOLE_COUNT)return false;
 const used=new Set();
 for(const track of atlas.tracks){
  if(!Array.isArray(track)||track.length!==326)return false;
  for(let score=0;score<track.length;score++){
   const hole=track[score];
   if(!integer(hole,0,LABYRINTH_HOLE_COUNT-1)||used.has(hole))return false;
   used.add(hole);
   if(score===0&&LABYRINTH_HOLE_CENTERS[hole].y<945)return false;
   if(score>0){
    const p=LABYRINTH_HOLE_CENTERS[track[score-1]],q=LABYRINTH_HOLE_CENTERS[hole];
    if(Math.hypot(p.x-q.x,p.y-q.y)>120)return false;
   }
  }
 }
 if(used.size!==LABYRINTH_HOLE_COUNT)return false;
 if(!atlas.guideAnchors||typeof atlas.guideAnchors!=='object'||
    Object.keys(atlas.guideAnchors).length!==32)return false;
 for(let score=10;score<=320;score+=10){
  const anchors=atlas.guideAnchors[String(score)];
  const printed=LABYRINTH_PRINTED_GUIDES[score];
  if(!printed||printed.length!==2)return false;
  if(!Array.isArray(anchors)||anchors.length!==2)return false;
  for(const anchor of anchors){
   if(!anchor||!integer(anchor.x,0,1253)||!integer(anchor.y,0,1253)||
      Math.hypot(anchor.x-printed[0],anchor.y-printed[1])>90)return false;
  }
  for(const track of atlas.tracks){
   const p=LABYRINTH_HOLE_CENTERS[track[score]];
   if(Math.min(...anchors.map(a=>Math.hypot(p.x-a.x,p.y-a.y)))>70)return false;
  }
 }
 return true;
}

// Score-to-lane policy is tested independently from artwork availability.
export function labyrinthPhysicalLaneScores({scores=[],teams=[]}={}){
 if(!Array.isArray(scores)||!Array.isArray(teams)||scores.length!==teams.length)
  return [];
 const distinct=[...new Set(teams)];
 // Two physical rails only: 3/4 independent players retain distinct, visible
 // virtual score displays, without falsely reusing another player's rail.
 if(distinct.length<1||distinct.length>2)return [];
 const result=[];
 for(const [lane,team] of distinct.entries()){
  const seat=teams.indexOf(team),score=scores[seat];
  if(!integer(score,0,325)||teams.some((t,i)=>t===team&&scores[i]!==score))
   return [];
  result.push({team,lane,score});
 }
 return result;
}
export function labyrinthPegPositions(state={},atlas){
 if(!validateLabyrinthPegAtlas(atlas))return [];
 return labyrinthPhysicalLaneScores(state).map(p=>{
  const hole=LABYRINTH_HOLE_CENTERS[atlas.tracks[p.lane][p.score]];
  return {...p,x:hole.x,y:hole.y};
 });
}

// Content is constructed strictly from integer validated coordinates and
// fixed SVG attributes; no untrusted image or session string enters markup.
export function renderLabyrinthPegOverlay(state,atlas){
 const pegs=labyrinthPegPositions(state,atlas);
 if(!pegs.length)return '';
 const circles=pegs.map(p=>'<circle class="lab-physical-peg lab-physical-peg--'+p.lane+
  '" cx="'+p.x+'" cy="'+p.y+'" r="9" data-peg-score="'+p.score+
  '" aria-label="Lane '+(p.lane+1)+' score '+p.score+'"></circle>').join('');
 return '<svg class="lab-peg-overlay" viewBox="0 0 1254 1254" '+
  'preserveAspectRatio="xMidYMid meet" role="img" aria-label="Verified physical peg locations">'+
  circles+'</svg>';
}
