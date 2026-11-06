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
 assert(scene.includes('buzz-kevin-frame-'));
 assert(scene.includes('buzz-mom-pose-'));
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
 assert.equal(crashVisualPhase(949),'entry');
 assert.equal(crashVisualPhase(950),'lecture');
 assert.equal(crashVisualPhase(4449),'lecture');
 assert.equal(crashVisualPhase(4450),'pause');
 assert.equal(crashVisualPhase(4949),'pause');
 assert.equal(crashVisualPhase(4950),'splash');
 assert.equal(crashVisualPhase(6500),'complete');
 assert.equal(momPoseAt(0),0);
 assert.equal(momPoseAt(2200),4);
 assert(BUZZ_MOM_LINES.length>=4);
 const ui=readFileSync(new URL('../src/buzzkill-ui.js',import.meta.url),'utf8');
 assert(ui.includes('cinematicActive=true'));
 assert(ui.includes('onSplash:'));
 assert(ui.includes('onComplete:'));
 assert(ui.includes("bust.classList.toggle('bz-show',splashShown)"));
});

test('BUZZKILL visibility recovery holds full-body character in stage and door fully in frame',async()=>{
 const {BUZZ_CINEMATIC}=await import('../src/buzzkill-cinematic.js');
 assert.equal(BUZZ_CINEMATIC.lectureEndMs-BUZZ_CINEMATIC.lectureBeginMs,3500);
 assert.equal(BUZZ_CINEMATIC.splashAtMs-BUZZ_CINEMATIC.lectureEndMs,500);
 assert(BUZZ_CINEMATIC.completeMs>BUZZ_CINEMATIC.splashAtMs+1000);
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 // The fallback placeholders must NOT be used for ordinary game rendering.
 const atlas=readFileSync(new URL('../public/assets/420bet/buzzkill/cinematic-v2/kevin-clean-atlas.webp',import.meta.url));
 assert(atlas.length>200000,'Illustrated Kevin atlas must contain real image data');
 assert.equal(atlas.toString('ascii',0,4),'RIFF');
 assert.equal(atlas.toString('ascii',8,12),'WEBP');
 assert(scene.includes("this.load.spritesheet('buzz-kevin-clean'"));
 assert(scene.includes("this.kevin=this.add.sprite(570,540,use('buzz-kevin-clean','buzz-kevin-lift1'))"));
 assert(scene.includes("this.kevin.setFrame(index)"));
 assert(scene.includes("s.kevin.setTexture('buzz-kevin-clean').setFrame(0)"));
 assert(scene.includes("this.mom=this.add.image(1065,540,use('buzz-mom-pose-1','buzz-mom-entry'))"));
 assert(scene.includes("s.mom.setTexture(s.textures.exists('buzz-mom-pose-1')"));
 assert(scene.includes("schedule(280,()=>pose(2))"));
 assert(scene.includes("schedule(600,()=>pose(3))"));
 assert(scene.includes("schedule(2000,()=>pose(5))"));
 assert(scene.includes("schedule(3400,()=>pose(6))"));
 assert(scene.includes("s.doorPanel.setAlpha(1)"));
 assert(scene.includes("s.mom.setPosition(1005,540)"));
 assert(scene.includes("s.bubbleText.setText(say).setAlpha(1)"));
 assert(scene.includes("schedule(BUZZ_CINEMATIC.lectureEndMs"));
 assert(scene.includes("schedule(BUZZ_CINEMATIC.splashAtMs"));
 assert(scene.includes("schedule(BUZZ_CINEMATIC.completeMs"));
 // 1200-wide stage: max Mom x 1145 + half sprite width 127.5 would clip
 // at the first frame, so her fully visible start x must remain <=1072.
 assert(scene.includes("setVisible(true).setAlpha(1).setPosition(1065,540)"));
 assert(1065 + 255/2 < 1200, 'Door-entry art must not clip on right');
});
