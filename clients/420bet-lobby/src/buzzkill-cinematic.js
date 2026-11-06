// BUZZKILL! visual-only crash choreography. Never controls payout or crash timing.
export const BUZZ_CINEMATIC=Object.freeze({
 doorOpenMs:1000,
 enterCompleteMs:2200,
 lectureBeginMs:2200,
 lectureEndMs:5700,
 pauseMs:500,
 splashAtMs:6200,
 splashDurationMs:1550,
 completeMs:7750,
});
export const BUZZ_MOM_LINES=Object.freeze([
 'KEVIN! WHAT THE HELL\nARE YOU DOING IN HERE?!',
 'KEVIN! OPEN A WINDOW\nRIGHT NOW!',
 'YOUR MACARONI IS\nGETTING COLD!',
 'WHY ARE MY TOWELS\nUNDER YOUR DOOR?!',
 'YOU ARE TWENTY-SEVEN\nYEARS OLD!',
]);
export function momPoseAt(ms){
 if(!Number.isFinite(ms)||ms<0)throw new RangeError('Invalid cinematic time');
 const times=[0,230,470,720,980,1250,1520,1870,2200,3150,4200,5100];
 let index=0;
 for(let i=1;i<times.length;i++)if(ms>=times[i])index=i;
 return index;
}
export function crashVisualPhase(ms){
 if(!Number.isFinite(ms)||ms<0)throw new RangeError('Invalid cinematic time');
 if(ms<BUZZ_CINEMATIC.enterCompleteMs)return 'entry';
 if(ms<BUZZ_CINEMATIC.lectureEndMs)return 'lecture';
 if(ms<BUZZ_CINEMATIC.splashAtMs)return 'pause';
 if(ms<BUZZ_CINEMATIC.completeMs)return 'splash';
 return 'complete';
}
