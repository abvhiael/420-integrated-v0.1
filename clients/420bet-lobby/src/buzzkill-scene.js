// Phaser 4 scene — animation is presentation only, never a source of outcome.
import * as Phaser from 'phaser';
import {BUZZ_CINEMATIC,BUZZ_MOM_LINES,momPoseAt} from './buzzkill-cinematic.js';
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
   for(let i=1;i<=8;i++)this.load.image('buzz-kevin-frame-'+i,CIN+'kevin-levitate-'+String(i).padStart(2,'0')+'.webp');
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
   this.cloudIllustration=this.textures.exists('buzz-fx-clouds')?this.add.image(570,480,'buzz-fx-clouds').setDisplaySize(360,270).setAlpha(0).setDepth(4):null;
   this.flowerIllustration=this.textures.exists('buzz-fx-flowers')?this.add.image(250,315,'buzz-fx-flowers').setDisplaySize(260,260).setAlpha(0).setDepth(4):null;
   this.kevin=this.add.image(570,478,use('buzz-kevin-frame-1',use('buzz-kevin-lift1','buzz-kevin'))).setDisplaySize(350,350).setDepth(5);
   this.mom=this.add.image(1230,352,use('buzz-mom-pose-1',use('buzz-mom-entry','buzz-mom'))).setDisplaySize(330,440).setDepth(9);
   this.mom.setVisible(false);
   this.doorGlow=this.add.rectangle(1070,315,178,448,0xffedb6,0).setDepth(8);
   // The door is a separate articulated prop; the fixed room never pans or scales.
   this.doorShadow=this.add.rectangle(1075,304,154,393,0x170b20,.0).setDepth(7);
   this.doorPanel=this.add.container(1145,106).setDepth(8);
   const panel=this.add.rectangle(-75,192,150,385,0x98553c,1).setStrokeStyle(8,0x562b36,1);
   const upper=this.add.rectangle(-75,105,113,150,0xc77e52,1).setStrokeStyle(6,0x673b47,1);
   const lower=this.add.rectangle(-75,281,113,171,0xc77e52,1).setStrokeStyle(6,0x673b47,1);
   const knob=this.add.circle(-130,214,9,0xffda6d).setStrokeStyle(3,0x4c2c32);
   this.doorPanel.add([panel,upper,lower,knob]);this.doorPanel.setAlpha(0);
   this.bubble=this.add.graphics().setDepth(10).setAlpha(0);
   this.bubble.fillStyle(0xfff3d9,1);
   this.bubble.fillRoundedRect(615,95,450,152,36);
   this.bubble.fillTriangle(941,232,1002,232,992,273);
   this.bubble.lineStyle(7,0x2f143b,1);this.bubble.strokeRoundedRect(615,95,450,152,36);
   this.bubbleText=this.add.text(840,171,'',{fontFamily:'Arial Black, sans-serif',fontSize:'29px',color:'#241021',align:'center',fontStyle:'bold',wordWrap:{width:410}}).setOrigin(.5).setAlpha(0).setDepth(11);
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
   const intensity=cinematicEffectsOff?0:Phaser.Math.Clamp(Math.log2(Math.max(1,level))/3.4,0,1);
   const lift=crashed?0:Math.min(198,Math.log(Math.max(1,level))*79);
   const bob=!reducedMotion&&!crashed?Math.sin(t*1.5)*7:0;
   if(!crashed){
     const index=level>=10?8:level>=7?7:level>=4.2?6:level>=3.4?5:level>=2.4?4:level>=1.8?3:level>=1.35?2:1;
     const pose=this.textures.exists('buzz-kevin-frame-'+index)?'buzz-kevin-frame-'+index:level>=4.2?'buzz-kevin-lift3':level>=2?'buzz-kevin-lift2':'buzz-kevin-lift1';
     if(this.textures.exists(pose)&&this.kevin.texture.key!==pose)this.kevin.setTexture(pose);
     this.kevin.y=472-lift+bob;this.kevin.angle=reducedMotion?0:Math.sin(t*.65)*2;
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
   const cy=this.kevin.y+126;
   for(let i=0;i<6;i++){const px=520+i*20,py=cy+(reducedMotion?0:Math.sin(t*1.8+i)*5);this.cloud.fillEllipse(px,py,80,36);}
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
   s.mom.setVisible(false).setPosition(1230,352).setAlpha(1);
   s.mom.setTexture(s.textures.exists('buzz-mom-pose-1')?'buzz-mom-pose-1':s.textures.exists('buzz-mom-entry')?'buzz-mom-entry':'buzz-mom');
   s.doorPanel.setAlpha(0).setScale(1,1);
   s.doorShadow.setAlpha(0);s.doorGlow.setAlpha(0);
   s.bubble.setAlpha(0);s.bubbleText.setAlpha(0);s.bubbleText.setText('');
   s.crashText.setAlpha(0);s.momQuote.setAlpha(0);
   if(s.crashSplash)s.crashSplash.setAlpha(0);
   s.kevin.setAlpha(1).setAngle(0).setPosition(570,472);
   s.kevin.setTexture(s.textures.exists('buzz-kevin-frame-1')?'buzz-kevin-frame-1':s.textures.exists('buzz-kevin-lift1')?'buzz-kevin-lift1':'buzz-kevin');
  },
  bust({onSplash=()=>{},onComplete=()=>{}}={}){
   if(crashed)return;
   crashed=true;
   if(!sceneRef){onSplash();onComplete();return;}
   const s=sceneRef,gen=++crashGeneration;
   const schedule=(ms,fn)=>s.time.delayedCall(ms,()=>{if(!disposed&&gen===crashGeneration)fn();});
   const pose=i=>{const key='buzz-mom-pose-'+i;if(s.textures.exists(key))s.mom.setTexture(key);};
   s.mom.setVisible(true).setAlpha(0).setPosition(1215,353);
   s.doorPanel.setAlpha(1).setScale(1,1);s.doorShadow.setAlpha(.93);s.doorGlow.setAlpha(.6);
   s.tweens.add({targets:s.doorPanel,scaleX:.15,duration:BUZZ_CINEMATIC.doorOpenMs,ease:'Cubic.Out'});
   s.tweens.add({targets:s.mom,x:1030,alpha:1,duration:BUZZ_CINEMATIC.enterCompleteMs,ease:'Cubic.Out'});
   schedule(280,()=>pose(2));schedule(600,()=>pose(3));
   schedule(BUZZ_CINEMATIC.enterCompleteMs,()=>{
    pose(4);
    const line=BUZZ_MOM_LINES[(s.roundVisualSeed||0)%BUZZ_MOM_LINES.length];
    s.roundVisualSeed=(s.roundVisualSeed||0)+1;
    s.bubbleText.setText(line);
    s.bubble.setAlpha(1);s.bubbleText.setAlpha(1);
   });
   schedule(1475,()=>pose(5));
   schedule(1925,()=>pose(6));
   schedule(BUZZ_CINEMATIC.lectureEndMs,()=>{
    s.bubble.setAlpha(0);s.bubbleText.setAlpha(0);
    cinematicEffectsOff=true;
    s.tweens.add({targets:s.kevin,y:476,angle:-7,duration:BUZZ_CINEMATIC.pauseMs,ease:'Cubic.Out'});
    s.doorGlow.setAlpha(0);
   });
   // The half-second pause begins AFTER the lecture and dialogue have ended.
   schedule(BUZZ_CINEMATIC.splashAtMs,()=>{
    if(s.crashSplash){
     s.crashSplash.setAlpha(1).setScale(.7);
     s.tweens.add({targets:s.crashSplash,scale:1.0,duration:235,ease:'Back.Out'});
    }else s.crashText.setAlpha(1);
    onSplash();
    if(!reducedMotion)s.cameras.main.shake(180,.005);
   });
   schedule(BUZZ_CINEMATIC.completeMs,()=>{onComplete();});
  },
  destroy(){if(disposed)return;disposed=true;sceneRef=null;game?.destroy(true);game=null;}
 };
 return api;
}
