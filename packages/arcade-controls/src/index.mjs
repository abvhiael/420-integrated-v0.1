// ARC-1.10: host-owned game/session controller. Restart creates a fresh scoped instance.
export class ArcadeControlError extends Error{constructor(message){super(message);this.name='ArcadeControlError';}}
const fail=s=>{throw new ArcadeControlError(s);};
const allowedKeys=new Set(['volume','muted','reducedMotion','highContrast']);
export function validateSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowedKeys.has(k)))fail('Unknown settings keys');
 const {volume=0.5,muted=true,reducedMotion=false,highContrast=false}=value;
 if(typeof volume!=='number'||!Number.isFinite(volume)||volume<0||volume>1||[muted,reducedMotion,highContrast].some(x=>typeof x!=='boolean'))fail('Invalid settings');
 return Object.freeze({volume,muted,reducedMotion,highContrast});
}
export class UniversalGameControls{
 #gameId;#create;#game=null;#input;#audio;#onStatus;#state='idle';#settings;#disposed=false;#busy=false;#generation=0;#container=null;
 constructor({gameId,createGame,input=null,audio=null,onStatus=()=>{},settings={}}){
  if(typeof gameId!=='string'||!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(gameId)||typeof createGame!=='function'||typeof onStatus!=='function')fail('Invalid game scope');
  if(input&&input.gameId!==gameId||audio&&audio.gameId!==undefined&&audio.gameId!==gameId)fail('Foreign game controls');
  this.#gameId=gameId;this.#create=createGame;this.#input=input;this.#audio=audio;this.#onStatus=onStatus;this.#settings=validateSettings(settings);
 }
 get state(){return this.#state;}get gameId(){return this.#gameId;}get settings(){return this.#settings;}
 #emit(){this.#onStatus(Object.freeze({gameId:this.#gameId,state:this.#state,settings:this.#settings}));}
 #check(){if(this.#disposed)fail('Controller disposed');if(this.#busy)fail('Transition already in progress');}
 async mount(container){
  this.#check();if(this.#state!=='idle'||!container||typeof container.appendChild!=='function')fail('Invalid mount');
  this.#container=container;this.#busy=true;const token=++this.#generation;this.#state='loading';this.#emit();
  let instance=null;
  try{
   instance=await this.#create({gameId:this.#gameId,settings:this.#settings});
   if(this.#disposed||token!==this.#generation){instance?.unmount?.();return false;}
   if(!instance||instance.gameId!==this.#gameId||!['mount','pause','resume','unmount'].every(k=>typeof instance[k]==='function')||instance.state!=='created')fail('Invalid game adapter');
   this.#game=instance;
   if(await instance.mount(container,{gameId:this.#gameId})!==true)fail('Game mount failed');
   if(this.#disposed||token!==this.#generation){instance.unmount();return false;}
   if(instance.state!=='running')fail('Game did not enter running state');
   this.#input?.enable?.();this.#state='running';this.#emit();return true;
  }catch(e){instance?.unmount?.();if(!this.#disposed){this.#input?.disable?.();this.#audio?.pause?.();this.#game=null;this.#state='error';this.#emit();}throw e;}
  finally{this.#busy=false;}
 }
 pause(){
  this.#check();if(this.#state!=='running')fail('Pause requires running');
  try{this.#input?.disable?.();this.#audio?.pause?.();this.#game.pause();if(this.#game.state!=='paused')fail('Adapter pause failed');this.#state='paused';this.#emit();}
  catch(e){this.dispose();throw e;}
 }
 resume(){
  this.#check();if(this.#state!=='paused')fail('Resume requires paused');
  try{this.#game.resume();if(this.#game.state!=='running')fail('Adapter resume failed');this.#audio?.resume?.();this.#input?.enable?.();this.#state='running';this.#emit();}
  catch(e){this.dispose();throw e;}
 }
 async restart(){
  this.#check();if(!['running','paused','error'].includes(this.#state)||!this.#container)fail('Restart requires active or failed game');
  // Never restore previous score or session state on restart.
  const container=this.#container;this.#input?.disable?.();this.#audio?.pause?.();
  this.#game?.unmount();this.#game=null;this.#state='idle';this.#emit();
  return this.mount(container);
 }
 updateSettings(partial){
  this.#check();if(!partial||typeof partial!=='object'||Array.isArray(partial))fail('Invalid settings patch');
  const next=validateSettings({...this.#settings,...partial});
  this.#audio?.setVolume?.(next.volume);this.#audio?.setMuted?.(next.muted);
  this.#settings=next;this.#emit();return next;
 }
 dispose(){
  if(this.#disposed)return;
  this.#disposed=true;this.#generation++;this.#input?.disable?.();this.#audio?.pause?.();this.#game?.unmount();this.#game=null;this.#state='disposed';this.#emit();
 }
}
