import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {BUZZ_RULES,createBuzzkill,buzzAction,sampleCrashPoint,multiplierAt,tickDuration} from '../src/buzzkill-engine.js';
import {createBuzzkillPractice} from '../src/buzzkill-ui.js';
const R=()=>.2;
test('BUZZKILL Crash survival curve targets 96% theoretical RTP',()=>{
 assert.equal(BUZZ_RULES.rtp,.96);
 assert.equal(sampleCrashPoint(()=>.99),1);
 assert.equal(sampleCrashPoint(()=>.8),1.2);
 assert.equal(sampleCrashPoint(()=>.2),4.8);
 for(const x of [1.01,1.25,2,4.2,10,20,100]){
  const survival=.96/x;
  assert(Math.abs(survival*x-.96)<1e-12);
  assert(Math.abs(multiplierAt(tickDuration(x))-x)<1e-8);
 }
 assert.throws(()=>sampleCrashPoint(()=>1),RangeError);
 assert.throws(()=>sampleCrashPoint(()=>-.1),RangeError);
});
test('Wager locked during round and instant-bust never pays after begin',()=>{
 const s=createBuzzkill({rng:()=>.99,balance:100,bet:10});
 assert(buzzAction(s,'start'));assert.equal(s.balance,90);
 assert.equal(buzzAction(s,'bet',20),false);
 assert(buzzAction(s,'tick',0));assert.equal(s.phase,'bust');
 assert.equal(buzzAction(s,'cashout'),false);assert.equal(s.return,0);
 assert.equal(s.history.length,1);
});
test('Manual cash out settles exactly once; round continues until Mom interrupts',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10});
 buzzAction(s,'start');buzzAction(s,'tick',tickDuration(2));
 assert(s.multiplier>=1.99&&s.multiplier<=2);
 assert(buzzAction(s,'cashout'));
 const balance=s.balance,returned=s.return;
 assert(returned>=19.9&&returned<=20);
 assert.equal(buzzAction(s,'cashout'),false);
 assert.equal(s.balance,balance);
 buzzAction(s,'tick',tickDuration(5));
 assert.equal(s.phase,'bust');assert.equal(s.balance,balance);
 assert.equal(s.history[0].cashedAt,s.cashedAt);
});
test('Automatic cashout at 4.20x wins even when a single slow frame crosses the crash',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10});
 assert(buzzAction(s,'auto-enabled',true));
 buzzAction(s,'start');buzzAction(s,'tick',tickDuration(5));
 assert.equal(s.phase,'bust');assert.equal(s.return,42);
 assert.equal(s.balance,132);assert.equal(s.cashedAt,4.2);
 assert.equal(s.history[0].return,42);
});
test('Auto target above crash loses, and targets cannot be edited during a running round',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10,autoTarget:5});
 buzzAction(s,'auto-enabled',true);buzzAction(s,'start');
 assert.equal(buzzAction(s,'auto-target',2),false);
 buzzAction(s,'tick',tickDuration(6));
 assert.equal(s.return,0);assert.equal(s.balance,90);assert.equal(s.phase,'bust');
});
test('Practice-only controls, routes and fixed room assets',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createBuzzkillPractice(document,{animate:false,rng:R,balance:100});
 assert.equal(root.dataset.practiceGame,'buzzkill');
 assert.equal(root.querySelectorAll('.bz-stage').length,1);
 assert.match(root.textContent,/BUZZKILL!/);
 assert.match(root.textContent,/NO REAL WAGERS/);
 assert(root.querySelector('.bz-target'));
 assert(root.querySelector('.bz-cash'));
 assert.equal(root.querySelector('.bz-amount').textContent,'10.00');
 root.querySelector('.bz-cash').click();
 assert.equal(root.gameState.phase,'running');assert.equal(root.gameState.balance,90);
 root.stopAnimation();
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const catalogue=readFileSync(new URL('../src/catalogue.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='crash'?createBuzzkillPractice(document)"));
 assert(catalogue.includes("'BUZZKILL!'"));
 assert(scene.includes("import * as Phaser from 'phaser'"));
 assert(scene.includes("buzz-room"));
 for(const art of ['bedroom','kevin','mom']){
  const content=readFileSync(new URL('../public/assets/420bet/buzzkill/'+art+'.svg',import.meta.url),'utf8');
  assert.match(content,/<svg/);
 }
});


test('BUZZKILL first illustrated gameplay asset pack is integrated and valid WebP',()=>{
 const names=['bedroom-base','kevin-lift1','kevin-lift2','kevin-lift3','mom-entry','mom-buzzkill','fx-flowers','fx-clouds'];
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/420bet/buzzkill/gameplay-v1/asset-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.stage.fixed,true);
 assert.equal(manifest.rules.practiceOnly,true);
 for(const name of names){
  const bytes=readFileSync(new URL('../public/assets/420bet/buzzkill/gameplay-v1/'+name+'.webp',import.meta.url));
  assert(bytes.length>1000,name+' unexpectedly small');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 assert(scene.includes("ART+'bedroom-base.webp'"));
 assert(scene.includes("buzz-kevin-lift1"));
 assert(scene.includes("buzz-kevin-lift2"));
 assert(scene.includes("buzz-kevin-lift3"));
 assert(scene.includes("buzz-mom-buzzkill"));
 assert(scene.includes("buzz-fx-flowers"));
 assert(scene.includes("buzz-fx-clouds"));
 assert(scene.includes("this.textures.exists"));
});

test("Kevin's eight production cut-outs and Mom's six full-body poses are valid WebP sprites",()=>{
 for(const name of [...Array.from({length:8},(_,i)=>'kevin-levitate-'+String(i+1).padStart(2,'0')),...Array.from({length:6},(_,i)=>'mom-pose-'+String(i+1).padStart(2,'0')),'buzzkilled-splash']){
  const bytes=readFileSync(new URL('../public/assets/420bet/buzzkill/cinematic-v2/'+name+'.webp',import.meta.url));
  assert(bytes.length>3000,name+' sprite too small');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 assert(scene.includes("'buzz-kevin-clean'"));
 assert(scene.includes("this.load.spritesheet('buzz-mom-mirrored'"));
 assert(scene.includes('buzz-crash-splash'));
 assert(scene.includes('this.doorPanel'));
});
test('Mom completes her entry and speech, then pauses exactly 500ms before BUZZKILLED',async()=>{
 const {BUZZ_CINEMATIC,crashVisualPhase,momPoseAt,BUZZ_MOM_LINES}=await import('../src/buzzkill-cinematic.js');
 assert.equal(BUZZ_CINEMATIC.splashAtMs-BUZZ_CINEMATIC.lectureEndMs,500);
 assert(BUZZ_CINEMATIC.doorOpenMs<BUZZ_CINEMATIC.enterCompleteMs);
 assert(BUZZ_CINEMATIC.enterCompleteMs<BUZZ_CINEMATIC.lectureEndMs);
 assert(BUZZ_CINEMATIC.splashAtMs<BUZZ_CINEMATIC.completeMs);
 assert.equal(crashVisualPhase(0),'entry');
 assert.equal(crashVisualPhase(2199),'entry');
 assert.equal(crashVisualPhase(2200),'lecture');
 assert.equal(crashVisualPhase(5699),'lecture');
 assert.equal(crashVisualPhase(5700),'pause');
 assert.equal(crashVisualPhase(6199),'pause');
 assert.equal(crashVisualPhase(6200),'splash');
 assert.equal(crashVisualPhase(7750),'complete');
 assert.equal(momPoseAt(0),0);
 assert.equal(momPoseAt(2200),8);
 assert(BUZZ_MOM_LINES.length>=4);
 const ui=readFileSync(new URL('../src/buzzkill-ui.js',import.meta.url),'utf8');
 assert(ui.includes('cinematicActive=true'));
 assert(ui.includes('onSplash:'));
 assert(ui.includes('onComplete:'));
 assert(ui.includes("bust.classList.toggle('bz-show',splashShown)"));
});

test('Kevin begins on the floor, advances once through 8 frames, and never leaves the fixed bedroom',async()=>{
 const {BUZZ_STAGE,KEVIN_POSE_THRESHOLDS,kevinFrameForMultiplier,kevinYForMultiplier,kevinLiftForMultiplier,MOM_ENTRY_BEATS}=await import('../src/buzzkill-stage.js');
 assert.equal(KEVIN_POSE_THRESHOLDS.length,8);
 assert.equal(kevinFrameForMultiplier(1),0);
 assert.equal(kevinFrameForMultiplier(1.36),2);
 assert.equal(kevinFrameForMultiplier(7),7);
 assert.equal(kevinFrameForMultiplier(1e9),7);
 let last=0;
 for(const x of [1,1.01,1.15,1.5,2,4.2,7,10,100,1e9]){
  const now=kevinFrameForMultiplier(x);
  assert(now>=last,'Kevin must never loop backwards');
  last=now;
  assert(kevinYForMultiplier(x)>=475&&kevinYForMultiplier(x)<=BUZZ_STAGE.kevinFloorY+3);
  assert(kevinLiftForMultiplier(x)<=BUZZ_STAGE.maxLift);
 }
 assert.equal(kevinYForMultiplier(1,0),BUZZ_STAGE.kevinFloorY);
 assert.equal(MOM_ENTRY_BEATS.length,12);
 assert(MOM_ENTRY_BEATS.every((beat,i)=>i===0||beat.ms>=MOM_ENTRY_BEATS[i-1].ms));
 assert(MOM_ENTRY_BEATS.every(beat=>beat.x+BUZZ_STAGE.momWidth/2<BUZZ_STAGE.width));
 assert(BUZZ_STAGE.kevinFloorY+BUZZ_STAGE.kevinHeight*.12<BUZZ_STAGE.height);
});
test('BUZZKILL render uses cleaned Kevin and approved mirrored Mom atlas',async()=>{
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/buzzkill-ui.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/buzzkill.css',import.meta.url),'utf8');
 const {BUZZ_CINEMATIC}=await import('../src/buzzkill-cinematic.js');
 assert.equal(BUZZ_CINEMATIC.lectureEndMs-BUZZ_CINEMATIC.lectureBeginMs,3500);
 assert.equal(BUZZ_CINEMATIC.splashAtMs-BUZZ_CINEMATIC.lectureEndMs,500);
 assert(scene.includes("this.load.spritesheet('buzz-kevin-clean'"));
 assert(scene.includes('kevinFrameForMultiplier(level)'));
 assert(scene.includes('kevinYForMultiplier(level,bob)'));
 assert(scene.includes('this.cloudIllustration=null'));
 assert(scene.includes('this.flowerIllustration=null'));
 assert(scene.includes("this.load.spritesheet('buzz-mom-mirrored'"));
 assert(scene.includes(".setFrame(0)"));
 assert(scene.includes('.setDisplaySize(BUZZ_STAGE.momWidth,BUZZ_STAGE.momHeight)'));
 assert(scene.includes('MOM_ENTRY_BEATS.forEach'));
 assert(scene.includes("s.momOverlay.setFrame(frame)"));
 assert(scene.includes("duration:145,ease:'Sine.InOut'"));
 assert(scene.includes("s.bubbleText.setText(say).setAlpha(1)"));
 assert(scene.includes('schedule(BUZZ_CINEMATIC.lectureEndMs'));
 assert(scene.includes('schedule(BUZZ_CINEMATIC.splashAtMs'));
 assert(ui.includes("root.classList.toggle('bz-cinematic',cinematicActive)"));
 assert(css.includes('.bz-game.bz-cinematic .bz-mult-wrap'));
 assert(scene.includes("this.bubble.fillRoundedRect(565,55,355,175,30)"));
});

test('Approved mirrored Mom atlas is RGBA 12 frames, no old pose-trimming or duplicate door',async()=>{
 const file=readFileSync(new URL('../public/assets/420bet/buzzkill/cinematic-v3/mom-mirrored-12f.webp',import.meta.url));
 assert(file.length>60000,'Approved art should not be a placeholder');
 assert.equal(file.toString('ascii',0,4),'RIFF');
 assert.equal(file.toString('ascii',8,12),'WEBP');
 const {MOM_ENTRY_BEATS}=await import('../src/buzzkill-stage.js');
 assert.deepEqual(MOM_ENTRY_BEATS.map(x=>x.pose),[1,2,3,4,5,6,7,8,9,10,11,12]);
 assert(MOM_ENTRY_BEATS[7].ms>=1800,'Entrance should be slowed to at least 1.8 seconds');
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 assert(scene.includes("CIN+'kevin-clean-atlas.webp'"));
 assert(scene.includes("'buzz-mom-mirrored',ASSETS+'cinematic-v3/mom-mirrored-12f.webp'"));
 assert(scene.includes('frameWidth:200,frameHeight:300'));
 assert(scene.includes('s.doorPanel.setAlpha(0);s.doorShadow.setAlpha(0)'),'No duplicate illustrated door');
 assert(!scene.includes('this.momPoseKeys=new Map()'),'No dynamic transparent margin trimming');
 assert(scene.includes('s.momOverlay.setFrame(frame)'));
});
