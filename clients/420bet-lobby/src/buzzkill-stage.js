// BUZZKILL! artwork staging only; the practice Crash engine owns outcomes.
export const BUZZ_STAGE=Object.freeze({
 width:1200,height:675,kevinX:570,kevinFloorY:558,
 kevinWidth:320,kevinHeight:320,maxLift:78,hover:3,
 momDoorX:1076,momInX:1004,momFloorY:558,momHeight:405,momWidth:260,
});
// Kevin never loops back to a lower animation frame within a round.
// Every selected frame is part of one 4x2, 444px-cell production atlas.
export const KEVIN_POSE_THRESHOLDS=Object.freeze([1,1.16,1.36,1.75,2.35,3.2,4.8,7]);
export function kevinFrameForMultiplier(multiplier){
 if(!Number.isFinite(multiplier)||multiplier<1)throw new RangeError('Invalid multiplier');
 let index=0;
 for(let i=1;i<KEVIN_POSE_THRESHOLDS.length;i++){
  if(multiplier>=KEVIN_POSE_THRESHOLDS[i])index=i;
 }
 return index;
}
export function kevinLiftForMultiplier(multiplier){
 if(!Number.isFinite(multiplier)||multiplier<1)throw new RangeError('Invalid multiplier');
 // Logarithmic but hard-capped: stays inside the fixed bedroom forever.
 return Math.min(BUZZ_STAGE.maxLift,Math.log(multiplier)*41);
}
export function kevinYForMultiplier(multiplier,bob=0){
 const hover=Math.max(-BUZZ_STAGE.hover,Math.min(BUZZ_STAGE.hover,Number.isFinite(bob)?bob:0));
 return Math.max(475,BUZZ_STAGE.kevinFloorY-kevinLiftForMultiplier(multiplier)+hover);
}
// The 12 beats interpolate the six fully illustrated Mom key poses.
// Pose index is 1-based and never cycles; 0.5s final pause comes after speech.
export const MOM_ENTRY_BEATS=Object.freeze([
 {ms:0,pose:1,x:1076},
 {ms:120,pose:1,x:1069},
 {ms:230,pose:2,x:1054},
 {ms:340,pose:2,x:1040},
 {ms:460,pose:3,x:1026},
 {ms:580,pose:3,x:1016},
 {ms:700,pose:4,x:1008},
 {ms:830,pose:4,x:1004},
 {ms:950,pose:4,x:1004},
 {ms:1550,pose:5,x:1004},
 {ms:2770,pose:5,x:1004},
 {ms:3550,pose:6,x:1004},
]);
export function readableMomLine(line){return String(line).replace(/\n/g,' ').trim();}
