import test from 'node:test';
import assert from 'node:assert/strict';
import {CLIP_NAMES,describeClip,normalizeAnimationManifest,KushKrusherAnimator,acceptKushGameplayEvent} from '../src/index.mjs';
test('all 15 canonical clips resolve correct isolated paths and 10 frames',()=>{
 assert.equal(CLIP_NAMES.length,15);
 for(const name of CLIP_NAMES){const m=describeClip(name);assert.equal(m.frames.length,10);assert.equal(m.durationMs,1000);assert.match(m.manifest,/^\/assets\/arcade\/mad-buds\//);}
});
test('real gameplay event path: load, fire, tumble, fly, impact, recovery, victory',()=>{
 const seen=[];const a=new KushKrusherAnimator({onFrame:x=>seen.push(x)});
 for(const e of ['LOAD','FIRE','TUMBLE','HEAVY_FLIGHT','COLLIDE','RECOVER','WIN','APPROVE','IDLE'])acceptKushGameplayEvent(a,e);
 assert.equal(a.clip,'idle_annoyed');assert.equal(seen.length,10);
});
test('wrecking path and failure reaction',()=>{
 const a=new KushKrusherAnimator();
 for(const e of ['LOAD','FIRE','WRECK','COLLIDE','LOSE','ANGER','DISAPPROVE','IDLE'])acceptKushGameplayEvent(a,e);
 assert.equal(a.clip,'idle_annoyed');
});
test('invalid or unauthorized transition cannot jump to victory',()=>{
 const a=new KushKrusherAnimator();
 assert.throws(()=>acceptKushGameplayEvent(a,'WIN'),/invalid gameplay transition/);
 assert.throws(()=>acceptKushGameplayEvent(a,'SCORE=999'),/unrecognized game event/);
 assert.throws(()=>a.transition('../evil'),/unknown transition target/);
});
test('timing, terminal hold, loop, pause and reset',()=>{
 const a=new KushKrusherAnimator();
 assert.equal(a.frameIndex,0);a.tick(150);assert.equal(a.frameIndex,1);
 a.pause();a.tick(400);assert.equal(a.frameIndex,1);a.resume();a.tick(850);assert.equal(a.frameIndex,0);
 acceptKushGameplayEvent(a,'LOAD');a.tick(1000);assert.equal(a.frameIndex,9);assert.equal(a.finished,true);
 a.tick(200);assert.equal(a.frameIndex,9);a.reset();assert.equal(a.clip,'idle_annoyed');
 assert.throws(()=>a.tick(-1),/invalid delta/);
});
test('manifest fail closed on mismatched identity, ordering and hashes',()=>{
 const d=describeClip('idle_annoyed');const good={animationId:d.id,frameCount:10,frameWidth:1024,frameHeight:1024,fps:10,frames:d.frames.map(p=>({filename:p.split('/').at(-1),sha256:'a'.repeat(64),durationMs:100}))};
 assert.equal(normalizeAnimationManifest(good,'idle_annoyed').frames.length,10);
 assert.throws(()=>normalizeAnimationManifest({...good,animationId:'foreign'},'idle_annoyed'),/identity/);
 assert.throws(()=>normalizeAnimationManifest({...good,frames:[...good.frames].reverse()},'idle_annoyed'),/out-of-order/);
 assert.throws(()=>normalizeAnimationManifest({...good,fps:12},'idle_annoyed'),/FPS/);
});
