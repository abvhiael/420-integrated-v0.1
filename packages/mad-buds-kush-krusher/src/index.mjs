// KK Phase F: deterministic, local-only animation state and frame selection.
export const CLIPS=Object.freeze({
 idle:'idle_annoyed',impatient:'idle_foot_tap',loading:'cannon_loading',
 launching:'compression_launch',tumbling:'airborne_tumble',wrecking:'wrecking_ball',
 flying:'heavy_flight',impact:'impact_squash',recovering:'stuck_recovery',
 victory:'victory_fist_raise',failure:'irritated_failure',laughing:'laughing',
 angry:'angry',thumbsDown:'thumbs_down',thumbsUp:'thumbs_up'
});
const ENTRIES=Object.freeze(Object.values(CLIPS));
const STAGE=new Set(ENTRIES);
const LOOPS=new Set(['idle_annoyed','idle_foot_tap','airborne_tumble','heavy_flight','thumbs_down']);
const LINKS=Object.freeze({
 idle_annoyed:['idle_foot_tap','cannon_loading','angry','laughing','thumbs_up','thumbs_down'],
 idle_foot_tap:['idle_annoyed','cannon_loading','angry'],
 cannon_loading:['compression_launch','irritated_failure'],
 compression_launch:['airborne_tumble','heavy_flight','wrecking_ball','impact_squash'],
 airborne_tumble:['heavy_flight','wrecking_ball','impact_squash'],
 wrecking_ball:['heavy_flight','impact_squash'],
 heavy_flight:['airborne_tumble','wrecking_ball','impact_squash'],
 impact_squash:['stuck_recovery','victory_fist_raise','irritated_failure'],
 stuck_recovery:['idle_annoyed','victory_fist_raise','irritated_failure'],
 victory_fist_raise:['thumbs_up','laughing','idle_annoyed'],
 irritated_failure:['angry','thumbs_down','idle_annoyed'],
 laughing:['idle_annoyed','thumbs_up'],
 angry:['idle_annoyed','thumbs_down'],
 thumbs_down:['idle_annoyed','cannon_loading'],
 thumbs_up:['idle_annoyed','cannon_loading']
});
const NAMES=Object.freeze(['idle_annoyed','idle_foot_tap','cannon_loading','compression_launch','airborne_tumble','wrecking_ball','heavy_flight','impact_squash','stuck_recovery','victory_fist_raise','irritated_failure','laughing','angry','thumbs_down','thumbs_up']);
const fail=(message)=>{throw new Error('Kush Krusher animation: '+message)};
export function describeClip(clip){
 if(!STAGE.has(clip))fail('unknown clip');
 const number=String(NAMES.indexOf(clip)+1).padStart(2,'0');
 const prefix='kush_krusher_anim_'+number+'_'+clip;
 const directory='/assets/arcade/mad-buds/kush-krusher/animations/kk_anim_'+number+'_'+clip+'/';
 return Object.freeze({clip,id:'kk_anim_'+number+'_'+clip,number,loop:LOOPS.has(clip),
  frameCount:10,frameMs:100,durationMs:1000,directory,
  manifest:directory+prefix+'.json',
  frames:Object.freeze(Array.from({length:10},(_,i)=>directory+prefix+'_frame_'+String(i+1).padStart(2,'0')+'.png'))});
}
export function normalizeAnimationManifest(raw,clip){
 const expected=describeClip(clip);
 if(!raw||typeof raw!=='object'||raw.frameCount!==10||raw.frameWidth!==1024||raw.frameHeight!==1024)fail('invalid manifest dimensions');
 const id=raw.animationId??raw.animation_id;
 if(id!==expected.id)fail('animation identity mismatch');
 const fps=raw.fps??10;
 if(fps!==10)fail('unexpected playback FPS');
 if(raw.durationMs!==undefined&&raw.durationMs!==1000)fail('unexpected duration');
 if(raw.loop!==undefined&&raw.loop!==expected.loop)fail('unexpected looping contract');
 if(!Array.isArray(raw.frames)||raw.frames.length!==10)fail('invalid frames');
 const frames=raw.frames.map((entry,index)=>{
  const name=entry.filename??entry.file;
  if(name!==expected.frames[index].split('/').at(-1))fail('out-of-order or foreign frame');
  if(!/^[a-f0-9]{64}$/.test(entry.sha256??''))fail('missing frame checksum');
  const duration=entry.durationMs??entry.duration_ms??100;
  if(duration!==100)fail('frame timing mismatch');
  return Object.freeze({url:expected.frames[index],sha256:entry.sha256,durationMs:100});
 });
 return Object.freeze({...expected,frames:Object.freeze(frames)});
}
export class KushKrusherAnimator {
 #clip='idle_annoyed';#elapsed=0;#paused=false;#onFrame;#completed=false;
 constructor({onFrame=()=>{}}={}){if(typeof onFrame!=='function')throw new TypeError('onFrame callback required');this.#onFrame=onFrame;this.#emit();}
 get clip(){return this.#clip}
 get paused(){return this.#paused}
 get frameIndex(){return Math.min(9,Math.floor(this.#elapsed/100))}
 get finished(){return this.#completed}
 get frame(){return describeClip(this.#clip).frames[this.frameIndex]}
 #emit(){this.#onFrame(Object.freeze({clip:this.#clip,frameIndex:this.frameIndex,url:this.frame,finished:this.#completed}));}
 transition(next,{restart=false}={}){
  if(!STAGE.has(next))fail('unknown transition target');
  if(next===this.#clip&&!restart)return this.frame;
  if(next!==this.#clip&&!LINKS[this.#clip].includes(next))fail('invalid gameplay transition '+this.#clip+' -> '+next);
  this.#clip=next;this.#elapsed=0;this.#completed=false;this.#emit();return this.frame;
 }
 tick(deltaMs){
  if(!Number.isFinite(deltaMs)||deltaMs<0||deltaMs>1000)fail('invalid delta');
  if(this.#paused||this.#completed||deltaMs===0)return this.frame;
  const old=this.frameIndex;
  const loop=describeClip(this.#clip).loop;
  const total=this.#elapsed+deltaMs;
  if(loop)this.#elapsed=total%1000;
  else {this.#elapsed=Math.min(total,999);if(total>=1000)this.#completed=true;}
  if(old!==this.frameIndex||this.#completed)this.#emit();
  return this.frame;
 }
 pause(){this.#paused=true}
 resume(){this.#paused=false}
 reset(){this.#clip='idle_annoyed';this.#elapsed=0;this.#completed=false;this.#paused=false;this.#emit()}
}
// Game simulation owns collision, launch vectors, win/loss adjudication and control authority.
// This adapter consumes trusted game events; it cannot award points or settle any outcome.
export function acceptKushGameplayEvent(animator,event){
 if(!(animator instanceof KushKrusherAnimator))throw new TypeError('Animator required');
 const table={
  LOAD:'cannon_loading',FIRE:'compression_launch',TUMBLE:'airborne_tumble',
  HEAVY_FLIGHT:'heavy_flight',WRECK:'wrecking_ball',COLLIDE:'impact_squash',
  RECOVER:'stuck_recovery',WIN:'victory_fist_raise',LOSE:'irritated_failure',
  LAUGH:'laughing',ANGER:'angry',APPROVE:'thumbs_up',DISAPPROVE:'thumbs_down',
  IMPATIENT:'idle_foot_tap',IDLE:'idle_annoyed'
 };
 if(typeof event!=='string'||!Object.hasOwn(table,event))fail('unrecognized game event');
 return animator.transition(table[event]);
}
export const CLIP_NAMES=ENTRIES;
