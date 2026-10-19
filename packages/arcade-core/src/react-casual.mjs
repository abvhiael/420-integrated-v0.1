// ARC-1.5: guest-first React casual-game adapter. The UI renderer is injected.
const allowed=new Set(['kush-crush','420buddy']);
const transitions={created:['loading','disposed'],loading:['ready','disposed'],ready:['running','disposed'],running:['paused','disposed'],paused:['running','disposed'],disposed:[]};
export class CasualLifecycleError extends Error{constructor(message){super(message);this.name='CasualLifecycleError';}}
export function validateCasualManifest(manifest,canonical){
 if(!manifest||!canonical||manifest.gameId!==canonical.gameId||manifest.slug!==canonical.slug||
  !allowed.has(manifest.slug)||!/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/.test(manifest.gameId)||
  manifest.runtime!==canonical.runtime||!['react-puzzle','react-simulation'].includes(manifest.runtime)||
  manifest.registration!=='UNREGISTERED'||canonical.registration!=='UNREGISTERED'||
  manifest.walletRequiredForCore!==false||canonical.walletRequiredForCore!==false)
  throw new CasualLifecycleError('Unauthorized casual-game identity or runtime');
 for(const field of ['manifestVersion','rulesetVersion','contentVersion','saveSchemaVersion'])
  if(manifest[field]!==canonical[field])throw new CasualLifecycleError('Unqualified '+field);
}
export class ReactCasualAdapter{
 #state='created';#renderer;#view;#manifest;#controller=null;#handle=null;#token=0;#progress=null;
 constructor({manifest,canonical,renderView,view}){
  validateCasualManifest(manifest,canonical);
  if(typeof renderView!=='function')throw new TypeError('React renderer required');
  if(typeof view!=='function')throw new TypeError('Game component required');
  this.#manifest=Object.freeze({...manifest});this.#renderer=renderView;this.#view=view;
 }
 get state(){return this.#state;}
 get gameId(){return this.#manifest.gameId;}
 #move(to){if(!transitions[this.#state].includes(to))throw new CasualLifecycleError('Invalid lifecycle: '+this.#state+' -> '+to);this.#state=to;}
 async mount(container,context={}){
  if(this.#state!=='created')throw new CasualLifecycleError('Mount permitted exactly once');
  if(!container||typeof container.appendChild!=='function')throw new TypeError('DOM container required');
  if(context.gameId!==undefined&&context.gameId!==this.gameId)throw new CasualLifecycleError('Foreign game context');
  for(const key of ['provider','signingKey','verifiedScore','registry','wallet'])if(Object.hasOwn(context,key))throw new CasualLifecycleError('Privileged context rejected');
  this.#move('loading');const token=++this.#token;this.#controller=new AbortController();
  try{
   const handle=await this.#renderer({container,View:this.#view,gameId:this.gameId,signal:this.#controller.signal,paused:false});
   if(this.#state==='disposed'||token!==this.#token||this.#controller.signal.aborted){handle?.unmount?.();return false;}
   if(!handle||typeof handle.unmount!=='function'||typeof handle.render!=='function')throw new CasualLifecycleError('Invalid React renderer handle');
   this.#handle=handle;this.#move('ready');this.#move('running');return true;
  }catch(error){if(this.#state!=='disposed')this.unmount();throw error;}
 }
 pause(){if(this.#state!=='running')throw new CasualLifecycleError('Pause requires running');this.#move('paused');try{this.#handle.render({paused:true,progress:this.#progress===null?null:structuredClone(this.#progress)});}catch(error){this.unmount();throw error;}}
 resume(){if(this.#state!=='paused')throw new CasualLifecycleError('Resume requires paused');try{this.#handle.render({paused:false,progress:this.#progress===null?null:structuredClone(this.#progress)});this.#move('running');}catch(error){this.unmount();throw error;}}
 serialize(){if(!['running','paused'].includes(this.#state))throw new CasualLifecycleError('Game not active');return {gameId:this.gameId,contentVersion:this.#manifest.contentVersion,schemaVersion:this.#manifest.saveSchemaVersion,progress:structuredClone(this.#progress)};}
 restore(save){
  if(!['running','paused'].includes(this.#state))throw new CasualLifecycleError('Game not active');
  if(!save||save.gameId!==this.gameId||save.contentVersion!==this.#manifest.contentVersion||save.schemaVersion!==this.#manifest.saveSchemaVersion||!Object.hasOwn(save,'progress'))
   throw new CasualLifecycleError('Foreign, corrupt or incompatible save');
  const next=structuredClone(save.progress);this.#handle.render({paused:this.#state==='paused',progress:structuredClone(next)});this.#progress=next;
 }
 unmount(){if(this.#state==='disposed')return;this.#move('disposed');this.#token++;this.#controller?.abort();const handle=this.#handle;this.#handle=null;this.#progress=null;handle?.unmount();}
}
