// Phaser 4 scene — animation is presentation only, never a source of outcome.
import * as Phaser from 'phaser';
const ASSETS='/assets/420bet/buzzkill/';
const W=1200,H=675;
const colors=[0xffd849,0xff7a53,0xf349c6,0x9b60ff,0x53ecff,0x8dff64];
export function mountBuzzkillScene(parent,{reducedMotion=false}={}){
 let sceneRef=null,level=1,crashed=false,disposed=false,game=null;
 class BuzzkillScene extends Phaser.Scene{
  constructor(){super({key:'buzzkill-visual'});}
  preload(){
   this.load.svg('buzz-room',ASSETS+'bedroom.svg',{width:W,height:H});
   this.load.svg('buzz-kevin',ASSETS+'kevin.svg',{width:420,height:470});
   this.load.svg('buzz-mom',ASSETS+'mom.svg',{width:320,height:530});
  }
  create(){
   sceneRef=this;
   this.add.image(W/2,H/2,'buzz-room').setDisplaySize(W,H);
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
   this.kevin=this.add.image(570,478,'buzz-kevin').setDisplaySize(310,347).setDepth(5);
   this.mom=this.add.image(1320,355,'buzz-mom').setDisplaySize(275,455).setDepth(9);
   this.mom.setVisible(false);
   this.doorGlow=this.add.rectangle(1070,315,178,448,0xffedb6,0).setDepth(8);
   this.crashText=this.add.text(600,220,'BUZZKILL!',{fontFamily:'Arial Black, Impact, sans-serif',fontSize:'100px',fontStyle:'italic',color:'#ffbd2b',stroke:'#6f164c',strokeThickness:15,shadow:{offsetX:5,offsetY:7,color:'#1a0a24',blur:12}}).setOrigin(.5).setAlpha(0).setDepth(11);
   this.momQuote=this.add.text(690,320,'KEVIN! WHAT ON EARTH\nARE YOU DOING?!',{fontFamily:'Arial Black, sans-serif',fontSize:'27px',align:'center',color:'#241021',backgroundColor:'#fff2d3',padding:{x:18,y:13},wordWrap:{width:410}}).setOrigin(.5).setAlpha(0).setDepth(11);
   this.timeCounter=0;
  }
  update(_time,dt){
   if(!sceneRef||disposed)return;
   this.timeCounter+=Math.min(dt,55)/1000;
   const t=this.timeCounter;
   const intensity=crashed?0:Phaser.Math.Clamp(Math.log2(Math.max(1,level))/3.4,0,1);
   const lift=crashed?0:Math.min(198,Math.log(Math.max(1,level))*79);
   const bob=!reducedMotion&&!crashed?Math.sin(t*1.5)*7:0;
   if(!crashed){this.kevin.y=472-lift+bob;this.kevin.angle=reducedMotion?0:Math.sin(t*.65)*2;}
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
  reset(){level=1;crashed=false;if(!sceneRef)return;sceneRef.mom.setVisible(false);sceneRef.mom.x=1320;sceneRef.doorGlow.alpha=0;sceneRef.crashText.setAlpha(0);sceneRef.momQuote.setAlpha(0);sceneRef.kevin.setAlpha(1);},
  bust(){if(crashed)return;crashed=true;if(!sceneRef)return;const s=sceneRef;s.mom.setVisible(true);
   s.doorGlow.setAlpha(.6);
   if(reducedMotion){s.mom.x=1058;s.crashText.setAlpha(1);s.momQuote.setAlpha(1);s.kevin.y=475;return;}
   s.tweens.add({targets:s.mom,x:1050,duration:250,ease:'Back.Out'});
   s.tweens.add({targets:s.doorGlow,alpha:0,duration:400,delay:190});
   s.tweens.add({targets:s.kevin,y:481,angle:-12,duration:380,ease:'Bounce.Out'});
   s.tweens.add({targets:[s.crashText,s.momQuote],alpha:1,duration:180,delay:290});
   s.cameras.main.shake(280,.008);
  },
  destroy(){if(disposed)return;disposed=true;sceneRef=null;game?.destroy(true);game=null;}
 };
 return api;
}
