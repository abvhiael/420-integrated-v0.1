// BUZZKILL! visual-only crash choreography. Never controls payout or crash timing.
export const BUZZ_CINEMATIC=Object.freeze({
 doorOpenMs:420,
 enterCompleteMs:950,
 lectureBeginMs:950,
 lectureEndMs:4450,
 pauseMs:500,
 splashAtMs:4950,
 splashDurationMs:1550,
 completeMs:6500,
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
 if(ms<280)return 0;
 if(ms<600)return 1;
 if(ms<950)return 2;
 if(ms<2000)return 3;
 if(ms<3400)return 4;
 return 5;
}
export function crashVisualPhase(ms){
 if(!Number.isFinite(ms)||ms<0)throw new RangeError('Invalid cinematic time');
 if(ms<BUZZ_CINEMATIC.enterCompleteMs)return 'entry';
 if(ms<BUZZ_CINEMATIC.lectureEndMs)return 'lecture';
 if(ms<BUZZ_CINEMATIC.splashAtMs)return 'pause';
 if(ms<BUZZ_CINEMATIC.completeMs)return 'splash';
 return 'complete';
}
