// ARC-1.4: dependency-injected Phaser 3 compatible engine boundary.
// Creation is allowed only for an approved canonical action game. No implicit wallet or chain authority.
export const STATES=Object.freeze({CREATED:'created',LOADING:'loading',READY:'ready',RUNNING:'running',PAUSED:'paused',DISPOSED:'disposed'});
const idPattern=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
const actionSlugs=new Set(['bong-breaker','baked-invaders','puff-man','grasshopper','roach-run','high-climb','mad-bud-delivery']);
export class ArcadeLifecycleError extends Error {constructor(message){super(message);this.name='ArcadeLifecycleError';}}
export function assertPhaserGame(manifest,canonical) {
 if(!manifest||!canonical||!idPattern.test(manifest.gameId)||manifest.gameId!==canonical.gameId||manifest.slug!==canonical.slug||manifest.runtime!=='phaser'||canonical.runtime!=='phaser'||!actionSlugs.has(manifest.slug)||manifest.registration!=='UNREGISTERED'||manifest.walletRequiredForCore!==false)throw new ArcadeLifecycleError('Unapproved Phaser game manifest');
 for(const key of ['rulesetVersion','contentVersion','manifestVersion'])if(manifest[key]!==canonical[key]||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest[key]))throw new ArcadeLifecycleError('Version authority mismatch: '+key);
}
const permitted={created:['loading','disposed'],loading:['ready','disposed'],ready:['running','disposed'],running:['paused','disposed'],paused:['running','disposed'],disposed:[]};
export class PhaserGameAdapter {
 #state=STATES.CREATED;#game=null;#signal=null;#controller=null;#token=0;#factory;#manifest;#canonical;#scene;#saved=null;
 constructor({manifest,canonical,createEngine,scene}){
  assertPhaserGame(manifest,canonical);
  if(typeof createEngine!=='function')throw new TypeError('Phaser engine factory required');
  if(!scene||typeof scene!=='object')throw new TypeError('Explicit scene definition required');
  this.#manifest=Object.freeze({...manifest});this.#canonical=Object.freeze({...canonical});this.#factory=createEngine;this.#scene=scene;
 }
 get state(){return this.#state;}
 get gameId(){return this.#manifest.gameId;}
 #transition(next){if(!permitted[this.#state].includes(next))throw new ArcadeLifecycleError('Invalid lifecycle transition '+this.#state+' -> '+next);this.#state=next;}
 async mount(container,context={}){
  if(this.#state!=='created')throw new ArcadeLifecycleError('Mount permitted once only');
  if(!container||typeof container.appendChild!=='function')throw new TypeError('DOM container required');
  if(context.gameId!==undefined&&context.gameId!==this.gameId)throw new ArcadeLifecycleError('Foreign game context');
  if(context.signingKey!==undefined||context.provider!==undefined||context.verifiedScore!==undefined)throw new ArcadeLifecycleError('Privileged client context rejected');
  this.#transition('loading');const token=++this.#token;this.#controller=new AbortController();this.#signal=this.#controller.signal;
  try{
   const engine=await this.#factory({container,scene:this.#scene,gameId:this.gameId,signal:this.#signal});
   if(this.#state==='disposed'||token!==this.#token||this.#signal.aborted){engine?.destroy?.(true);return false;}
   if(!engine||typeof engine.destroy!=='function'||!engine.scene||typeof engine.scene.pause!=='function'||typeof engine.scene.resume!=='function')throw new ArcadeLifecycleError('Invalid Phaser engine');
   this.#game=engine;this.#transition('ready');this.#transition('running');return true;
  }catch(e){if(this.#state!=='disposed')this.unmount();throw e;}
 }
 pause(){this.#transition('paused');try{this.#game.scene.pause();}catch(e){this.unmount();throw e;}}
 resume(){if(this.#state!=='paused')throw new ArcadeLifecycleError('Resume requires paused state');try{this.#game.scene.resume();this.#transition('running');}catch(e){this.unmount();throw e;}}
 serialize(){if(!['running','paused'].includes(this.#state))throw new ArcadeLifecycleError('Not ready to serialize');return {gameId:this.gameId,contentVersion:this.#manifest.contentVersion,progress:this.#saved===null?null:structuredClone(this.#saved)};}
 restore(save){if(!['running','paused'].includes(this.#state))throw new ArcadeLifecycleError('Not ready to restore');if(!save||save.gameId!==this.gameId||save.contentVersion!==this.#manifest.contentVersion||!Object.hasOwn(save,'progress'))throw new ArcadeLifecycleError('Untrusted save envelope');this.#saved=structuredClone(save.progress);}
 unmount(){if(this.#state==='disposed')return;this.#transition('disposed');this.#token++;this.#controller?.abort();const game=this.#game;this.#game=null;this.#saved=null;game?.destroy(true);}
}
export function createPhaser3Factory(Phaser){
 if(typeof Phaser?.Game!=='function'||typeof Phaser?.AUTO!=='number')throw new TypeError('Phaser 3 implementation required');
 return async ({container,scene,signal})=>{
  if(signal.aborted)throw new ArcadeLifecycleError('Load aborted');
  return new Phaser.Game({type:Phaser.AUTO,parent:container,scene,autoFocus:false,pauseOnBlur:true});
 };
}
