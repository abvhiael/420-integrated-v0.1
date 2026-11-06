// Phaser 4 scene — animation is presentation only, never a source of outcome.
import * as Phaser from 'phaser';
import {BUZZ_CINEMATIC,BUZZ_MOM_LINES} from './buzzkill-cinematic.js';
import {BUZZ_STAGE,kevinFrameForMultiplier,kevinYForMultiplier,MOM_ENTRY_BEATS} from './buzzkill-stage.js';
const ASSETS='/assets/420bet/buzzkill/';
const ART=ASSETS+'gameplay-v1/';
const CIN=ASSETS+'cinematic-v2/';
const W=1200,H=675;
const colors=[0xffd849,0xff7a53,0xf349c6,0x9b60ff,0x53ecff,0x8dff64];
export function mountBuzzkillScene(parent,{reducedMotion=false}={}){
 let sceneRef=null,level=1,crashed=false,disposed=false,game=null,crashGeneration=0,cinematicEffectsOff=false;
 class BuzzkillScene extends Phaser.Scene{
  constructor(){super({key:'buzzkill-visual'});}
  preload(){
   this.load.svg('buzz-room',ASSETS+'bedroom.svg',{width:W,height:H});
   this.load.svg('buzz-kevin',ASSETS+'kevin.svg',{width:420,height:470});
   this.load.svg('buzz-mom',ASSETS+'mom.svg',{width:320,height:530});
   // Browser-optimized cropped illustration assets from the approved concept.
   this.load.image('buzz-room-art',ART+'bedroom-base.webp');
   this.load.image('buzz-kevin-lift1',ART+'kevin-lift1.webp');
   this.load.image('buzz-kevin-lift2',ART+'kevin-lift2.webp');
   this.load.image('buzz-kevin-lift3',ART+'kevin-lift3.webp');
   this.load.image('buzz-mom-entry',ART+'mom-entry.webp');
   this.load.image('buzz-mom-buzzkill',ART+'mom-buzzkill.webp');
   this.load.image('buzz-fx-flowers',ART+'fx-flowers.webp');
   this.load.image('buzz-fx-clouds',ART+'fx-clouds.webp');
   // Approved illustrated artwork, re-extracted with verified opacity.
   this.load.spritesheet('buzz-kevin-clean',CIN+'kevin-clean-atlas.webp',{frameWidth:444,frameHeight:444});
   for(let i=1;i<=6;i++)this.load.image('buzz-mom-pose-'+i,CIN+'mom-pose-'+String(i).padStart(2,'0')+'.webp');
   this.load.svg('buzz-crash-splash',CIN+'buzzkilled-action-splash.svg',{width:1200,height:530});
  }
  create(){
   sceneRef=this;
   const use=(illustrated,fallback)=>this.textures.exists(illustrated)?illustrated:fallback;
   this.add.image(W/2,H/2,use('buzz-room-art','buzz-room')).setDisplaySize(W,H);
   this.ambient=this.add.graphics().setDepth(1);
   this.rainbow=this.add.graphics().setDepth(2);
   this.smoke=this.add.graphics().setDepth(3);
   this.sparkles=this.add.graphics().setDepth(6);
   this.flowers=[];
   const coords=[[100,120],[300,180],[455,116],[741,154],[940,240],[1100,179],[380,385],[895,423],[620,110],[1025,365],[219,358],[105,418]];
   coords.forEach(([x,y],i)=>{
     const flower=this.add.text(x,y,i%3?'✿':'☮',{fontFamily:'Georgia, serif',fontSize:i%3?'64px':'54px',color:i%2?'#ffe967':'#ff7de2',stroke:'#752e9c',strokeThickness:6}).setOrigin(.5).setAlpha(0).setDepth(4);
     this.flowers.push({flower,x,y,phase:i*.84});
   });
   this.cloud=this.add.graphics().setDepth(4);
   // Previous FX exports contained stray character heads and source-sheet labels.
   // Never lay those images over Kevin; only procedural text-free FX may render.
   this.cloudIllustration=null;
   this.flowerIllustration=null;
   // Trim giant transparent margins from the approved illustrated Mom poses.
   // The source images can have >300 empty rows; displaying the full image
   // creates jumpy transitions and apparent head/door clipping.
   this.momPoseKeys=new Map();
   for(let i=1;i<=6;i++){
     const key='buzz-mom-pose-'+i;
     if(!this.textures.exists(key))continue;
     try{
       const source=this.textures.get(key).getSourceImage();
       const w=source.width,h=source.height;
       const scan=document.createElement('canvas');scan.width=w;scan.height=h;
       const context=scan.getContext('2d',{willReadFrequently:true});
       context.drawImage(source,0,0);
       const pixels=context.getImageData(0,0,w,h).data;
       let left=w,top=h,right=-1,bottom=-1;
       for(let y=0;y<h;y++)for(let x=0;x<w;x++){
         if(pixels[(y*w+x)*4+3]>48){
           if(x<left)left=x;if(x>right)right=x;
           if(y<top)top=y;if(y>bottom)bottom=y;
         }
       }
       if(right<left||bottom<top)continue;
       const pad=8;
       left=Math.max(0,left-pad);top=Math.max(0,top-pad);
       right=Math.min(w-1,right+pad);bottom=Math.min(h-1,bottom+pad);
       const crop=document.createElement('canvas');
       crop.width=right-left+1;crop.height=bottom-top+1;
       crop.getContext('2d').drawImage(source,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
       const croppedKey=key+'-trimmed';
       this.textures.addCanvas(croppedKey,crop);
       this.momPoseKeys.set(i,croppedKey);
     }catch(_err){this.momPoseKeys.set(i,key);}
   }
   // Use clean real illustrated poses, never the crude vector placement graphics.
   this.kevin=this.add.sprite(BUZZ_STAGE.kevinX,BUZZ_STAGE.kevinFloorY,use('buzz-kevin-clean','buzz-kevin-lift1'))
     .setOrigin(.5,.88).setDisplaySize(BUZZ_STAGE.kevinWidth,BUZZ_STAGE.kevinHeight)
     .setAlpha(1).setVisible(true).setDepth(5);
   this.mom=this.add.image(BUZZ_STAGE.momDoorX,BUZZ_STAGE.momFloorY,this.momPoseKeys.get(1)||use('buzz-mom-pose-1','buzz-mom-entry'))
     .setOrigin(.5,1).setAlpha(1).setDepth(9);
   const initialMomWidth=Math.min(BUZZ_STAGE.momWidth,BUZZ_STAGE.momHeight*this.mom.width/Math.max(1,this.mom.height));
   this.mom.setDisplaySize(initialMomWidth,BUZZ_STAGE.momHeight);
   // Pose-to-pose crossfade, not abrupt frame swapping.
   this.momOverlay=this.add.image(BUZZ_STAGE.momDoorX,BUZZ_STAGE.momFloorY,this.mom.texture.key)
     .setOrigin(.5,1).setDisplaySize(initialMomWidth,BUZZ_STAGE.momHeight)
     .setVisible(false).setAlpha(0).setDepth(9.2);
   this.mom.setVisible(false);
   this.doorGlow=this.add.rectangle(1070,315,178,448,0xffedb6,0).setDepth(8);
   // The door is a separate articulated prop; the fixed room never pans or scales.
   this.doorShadow=this.add.rectangle(1067,302,154,393,0x170b20,.0).setDepth(7);
   this.doorPanel=this.add.container(1144,106).setDepth(8);
   const panel=this.add.rectangle(-75,192,150,385,0x98553c,1).setStrokeStyle(8,0x562b36,1);
   const upper=this.add.rectangle(-75,105,113,150,0xc77e52,1).setStrokeStyle(6,0x673b47,1);
   const lower=this.add.rectangle(-75,281,113,171,0xc77e52,1).setStrokeStyle(6,0x673b47,1);
   const knob=this.add.circle(-130,214,9,0xffda6d).setStrokeStyle(3,0x4c2c32);
   this.doorPanel.add([panel,upper,lower,knob]);this.doorPanel.setAlpha(0);
   this.bubble=this.add.graphics().setDepth(10).setAlpha(0);
   this.bubble.fillStyle(0xfff3d9,1);
   // Entire speech balloon lives LEFT of Mom and below neither sprite nor HUD.
   this.bubble.fillRoundedRect(565,55,355,175,30);
   this.bubble.fillTriangle(850,220,918,220,902,267);
   this.bubble.lineStyle(7,0x2f143b,1);this.bubble.strokeRoundedRect(565,55,355,175,30);
   this.bubbleText=this.add.text(742,139,'',{fontFamily:'Arial Black, sans-serif',fontSize:'25px',
     color:'#241021',align:'center',fontStyle:'bold',lineSpacing:6,wordWrap:{width:310}})
     .setOrigin(.5).setAlpha(0).setDepth(11);
   this.crashSplash=this.textures.exists('buzz-crash-splash')?this.add.image(600,345,'buzz-crash-splash').setAlpha(0).setDepth(12):null;
   if(this.crashSplash)this.crashSplash.setDisplaySize(850,365);
   this.crashText=this.add.text(600,220,'BUZZKILLED!',{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'100px',fontStyle:'italic',color:'#ffbd2b',stroke:'#6f164c',strokeThickness:15,shadow:{offsetX:5,offsetY:7,color:'#1a0a24',blur:12}}).setOrigin(.5).setAlpha(0).setDepth(11);
   this.momQuote=this.add.text(690,320,'KEVIN! WHAT ON EARTH\nARE YOU DOING?!',{fontFamily:'Arial Black, sans-serif',fontSize:'27px',align:'center',color:'#241021',backgroundColor:'#fff2d3',padding:{x:18,y:13},wordWrap:{width:410}}).setOrigin(.5).setAlpha(0).setDepth(11);
   this.crashText.setAlpha(0);
   this.momQuote.setAlpha(0);
   this.timeCounter=0;
  }
  update(_time,dt){
   if(!sceneRef||disposed)return;
   this.timeCounter+=Math.min(dt,55)/1000;
   const t=this.timeCounter;
   if(this.momOverlay?.visible){
     this.momOverlay.setPosition(this.mom.x,this.mom.y);
   }
   const intensity=cinematicEffectsOff?0:Phaser.Math.Clamp(Math.log2(Math.max(1,level))/3.4,0,1);
   const bob=!reducedMotion&&!crashed?Math.sin(t*1.5)*BUZZ_STAGE.hover:0;
   if(!crashed){
     // This frame index is monotonic within each round, never an animation loop.
     const index=kevinFrameForMultiplier(level);
     if(this.textures.exists('buzz-kevin-clean')){
       if(this.kevin.texture.key!=='buzz-kevin-clean')this.kevin.setTexture('buzz-kevin-clean');
       if(this.kevin.frame.name!==index)this.kevin.setFrame(index);
     }
     this.kevin.setVisible(true).setAlpha(1)
       .setDisplaySize(BUZZ_STAGE.kevinWidth,BUZZ_STAGE.kevinHeight)
       .setPosition(BUZZ_STAGE.kevinX,kevinYForMultiplier(level,bob))
       .setAngle(reducedMotion?0:Math.sin(t*.65)*1);
   }
   if(this.cloudIllustration){this.cloudIllustration.y=this.kevin.y+117;this.cloudIllustration.alpha=cinematicEffectsOff?0:Phaser.Math.Clamp(intensity*.58,0,.58);}
   if(this.flowerIllustration){this.flowerIllustration.alpha=cinematicEffectsOff?0:Phaser.Math.Clamp((intensity-.30)*.75,0,.62);this.flowerIllustration.rotation=reducedMotion?0:Math.sin(t*.35)*.06;}
   this.ambient.clear();
   this.ambient.fillStyle(0xa52fed,0.09+intensity*.16);this.ambient.fillRect(0,0,W,H);
   this.ambient.fillStyle(0x56fda9,intensity*.06);this.ambient.fillEllipse(600,310,900,470);
   this.rainbow.clear();
   if(intensity>.22){
    const arcAlpha=Math.min(.84,(intensity-.22)*1.5);
    for(let i=0;i<6;i++){
     this.rainbow.lineStyle(11,colors[i],arcAlpha);
     this.rainbow.beginPath();this.rainbow.arc(575,410,260-i*13,Math.PI*1.02,Math.PI*1.98,false);this.rainbow.strokePath();
    }
   }
   this.cloud.clear();this.cloud.fillStyle(0xdac4ff,.35+intensity*.23);
   // Kevin's approved frames already contain their own purple smoke cloud.
   // Do not paint a second sprite/loop below his body.
   const cy=this.kevin.y+8;
   if(!crashed&&level>1.4)for(let i=0;i<5;i++){
     const px=535+i*18,py=cy+(reducedMotion?0:Math.sin(t*1.2+i)*3);
     this.cloud.fillEllipse(px,py,62,22);
   }
   this.smoke.clear();
   for(let i=0;i<18;i++){
    const tt=(t*(reducedMotion?.10:1.1)+i*.63);
    const y=455-(tt*25)%430, x=560+Math.sin(tt*1.7+i*.9)*65;
    this.smoke.fillStyle(i%2?0xe9baff:0xadd9fb,.055+intensity*.029);this.smoke.fillCircle(x,y,13+(i%4)*7);
   }
   this.sparkles.clear();
   if(intensity>.3){for(let i=0;i<33;i++){const px=(i*179+37)%W,py=(i*103+67)%H;const rad=2+(i%3);this.sparkles.fillStyle(colors[i%6],intensity*.55);this.sparkles.fillCircle(px+(reducedMotion?0:Math.sin(t+i)*9),py,rad);}}
   this.flowers.forEach(({flower,x,y,phase})=>{
     const alpha=Phaser.Math.Clamp((intensity-.35)*2.8,0,1);flower.setAlpha(alpha);
     flower.y=y+(reducedMotion?0:Math.sin(t*.7+phase)*12);
     flower.rotation=reducedMotion?0:Math.sin(t*.38+phase)*.1;
     flower.setScale(.7+intensity*.32);
   });
  }
 }
 game=new Phaser.Game({type:Phaser.AUTO,parent,width:W,height:H,backgroundColor:'#1e1232',antialias:true,render:{pixelArt:false},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[BuzzkillScene]});
 const api={
  setLevel(mult){level=Number.isFinite(mult)?Math.max(1,mult):1;},
  reset(){
   crashGeneration++;level=1;crashed=false;cinematicEffectsOff=false;
   if(!sceneRef)return;
   const s=sceneRef;s.tweens.killAll();
   s.mom.setVisible(false).setPosition(BUZZ_STAGE.momDoorX,BUZZ_STAGE.momFloorY).setAlpha(1).setOrigin(.5,1);
   s.tweens.killTweensOf(s.momOverlay);
   s.momOverlay.setVisible(false).setAlpha(0);
   const first=s.momPoseKeys.get(1)||'buzz-mom-pose-1';
   if(s.textures.exists(first))s.mom.setTexture(first);
   s.mom.setDisplaySize(Math.min(BUZZ_STAGE.momWidth,BUZZ_STAGE.momHeight*s.mom.width/Math.max(1,s.mom.height)),BUZZ_STAGE.momHeight);
   s.doorPanel.setAlpha(0).setScale(1,1);
   s.doorShadow.setAlpha(0);s.doorGlow.setAlpha(0);
   s.bubble.setAlpha(0);s.bubbleText.setAlpha(0);s.bubbleText.setText('');
   s.crashText.setAlpha(0);s.momQuote.setAlpha(0);
   if(s.crashSplash)s.crashSplash.setAlpha(0);
   if(s.textures.exists('buzz-kevin-clean'))s.kevin.setTexture('buzz-kevin-clean').setFrame(0);
   else s.kevin.setTexture('buzz-kevin-lift1');
   s.kevin.setOrigin(.5,.88).setDisplaySize(BUZZ_STAGE.kevinWidth,BUZZ_STAGE.kevinHeight)
     .setVisible(true).setAlpha(1).setAngle(0).setPosition(BUZZ_STAGE.kevinX,BUZZ_STAGE.kevinFloorY);
  },
  bust({onSplash=()=>{},onComplete=()=>{}}={}){
   if(crashed)return;
   crashed=true;
   if(!sceneRef){onSplash();onComplete();return;}
   const s=sceneRef,gen=++crashGeneration;
   const schedule=(ms,fn)=>s.time.delayedCall(ms,()=>{if(!disposed&&gen===crashGeneration)fn();});
   const say=BUZZ_MOM_LINES[(s.roundVisualSeed||0)%BUZZ_MOM_LINES.length];
   s.roundVisualSeed=(s.roundVisualSeed||0)+1;
   s.kevin.setVisible(true).setAlpha(1); // Freeze Kevin at the crash altitude.
   s.mom.setVisible(true).setAlpha(1).setPosition(BUZZ_STAGE.momDoorX,BUZZ_STAGE.momFloorY);
   s.doorPanel.setAlpha(1).setScale(1,1);s.doorShadow.setAlpha(.93);s.doorGlow.setAlpha(.42);
   s.bubble.setAlpha(0);s.bubbleText.setAlpha(0).setText('');
   if(s.crashSplash)s.crashSplash.setAlpha(0);
   s.crashText.setAlpha(0);
   function pose(index){
     const key=s.momPoseKeys.get(index)||'buzz-mom-pose-'+index;
     if(!s.textures.exists(key)||s.mom.texture.key===key)return;
     const commit=()=>{
       s.mom.setTexture(key).setOrigin(.5,1);
       s.mom.setDisplaySize(Math.min(BUZZ_STAGE.momWidth,BUZZ_STAGE.momHeight*s.mom.width/Math.max(1,s.mom.height)),BUZZ_STAGE.momHeight);
     };
     if(reducedMotion){commit();return;}
     s.tweens.killTweensOf(s.momOverlay);
     s.momOverlay.setTexture(key).setOrigin(.5,1);
     s.momOverlay.setDisplaySize(Math.min(BUZZ_STAGE.momWidth,BUZZ_STAGE.momHeight*s.momOverlay.width/Math.max(1,s.momOverlay.height)),BUZZ_STAGE.momHeight);
     s.momOverlay.setPosition(s.mom.x,s.mom.y).setVisible(true).setAlpha(0);
     s.tweens.add({targets:s.momOverlay,alpha:1,duration:105,ease:'Sine.InOut',onComplete:()=>{
       if(disposed||gen!==crashGeneration)return;
       commit();s.momOverlay.setVisible(false).setAlpha(0);
     }});
   }
   pose(1);
   if(reducedMotion){
     s.doorPanel.setScale(.18,1);
     s.mom.setX(BUZZ_STAGE.momInX);
   }else{
     s.tweens.add({targets:s.doorPanel,scaleX:.18,duration:BUZZ_CINEMATIC.doorOpenMs,ease:'Sine.InOut'});
     // Twelve illustrated key beats, eased between six approved Mom poses.
     MOM_ENTRY_BEATS.forEach((beat,i)=>{
       schedule(beat.ms,()=>{
         pose(beat.pose);
         if(i<MOM_ENTRY_BEATS.length-1){
           const next=MOM_ENTRY_BEATS[i+1];
           if(next.x!==beat.x)s.tweens.add({targets:s.mom,x:next.x,duration:next.ms-beat.ms,ease:'Sine.InOut'});
         }
       });
     });
   }
   schedule(BUZZ_CINEMATIC.enterCompleteMs,()=>{
     s.mom.setX(BUZZ_STAGE.momInX);
     pose(4);
     s.bubbleText.setText(say).setAlpha(1);s.bubble.setAlpha(1);
   });
   schedule(2000,()=>pose(5));
   schedule(3400,()=>pose(6));
   schedule(BUZZ_CINEMATIC.lectureEndMs,()=>{
     s.bubble.setAlpha(0);s.bubbleText.setAlpha(0);
     cinematicEffectsOff=true;s.doorGlow.setAlpha(0);
   });
   // 3.5s readable speech, then 500ms silent hold, then illustrated splash.
   schedule(BUZZ_CINEMATIC.splashAtMs,()=>{
     if(s.crashSplash){
       s.crashSplash.setAlpha(1).setScale(reducedMotion?1:.7);
       if(!reducedMotion)s.tweens.add({targets:s.crashSplash,scale:1,duration:235,ease:'Back.Out'});
     }else s.crashText.setAlpha(1);
     onSplash();
     if(!reducedMotion)s.cameras.main.shake(180,.005);
   });
   schedule(BUZZ_CINEMATIC.completeMs,()=>onComplete());
  },
  destroy(){if(disposed)return;disposed=true;sceneRef=null;game?.destroy(true);game=null;}
 };
 return api;
}
