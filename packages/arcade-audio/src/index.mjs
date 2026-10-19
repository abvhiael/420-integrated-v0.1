export class AudioError extends Error{}
const ID=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
const cues=Object.freeze({confirm:[660,0.08,'Confirmed'],cancel:[330,0.1,'Cancelled'],notice:[440,0.12,'Notice']});
export class ArcadeAudio {
 #id;#factory;#context=null;#volume=0.5;#muted=true;#activated=false;#paused=false;#disposed=false;#voices=new Set();#onCue;
 constructor({gameId,createContext,onCue=()=>{}}){
  if(!ID.test(gameId))throw new AudioError('Invalid game identity');
  if(typeof createContext!=='function'||typeof onCue!=='function')throw new TypeError('Invalid audio dependencies');
  this.#id=gameId;this.#factory=createContext;this.#onCue=onCue;
 }
 get muted(){return this.#muted;}get activated(){return this.#activated;}get volume(){return this.#volume;}
 #check(){if(this.#disposed)throw new AudioError('Disposed');}
 #stop(){for(const v of this.#voices)v.stop();this.#voices.clear();}
 setMuted(value){this.#check();if(typeof value!=='boolean')throw new AudioError('Invalid mute');this.#muted=value;if(value)this.#stop();}
 setVolume(value){this.#check();if(!Number.isFinite(value)||value<0||value>1)throw new AudioError('Invalid volume');this.#volume=value;if(value===0)this.#stop();}
 async activate(gesture=false){this.#check();if(gesture!==true)throw new AudioError('User gesture required');if(this.#activated)return true;
  const ctx=this.#factory();if(!ctx||typeof ctx.resume!=='function'||typeof ctx.close!=='function'||typeof ctx.createOscillator!=='function'||typeof ctx.createGain!=='function')throw new AudioError('Web Audio unavailable');
  this.#context=ctx;try{await ctx.resume();if(this.#disposed){await ctx.close();return false;}if(ctx.state!=='running')throw new AudioError('Audio suspended');this.#activated=true;return true;}
  catch(e){this.#context=null;try{await ctx.close();}catch{}throw e;}
 }
 cue(name,gameId=this.#id){this.#check();if(gameId!==this.#id||!Object.hasOwn(cues,name))throw new AudioError('Unapproved cue');
  const [freq,duration,text]=cues[name];this.#onCue({gameId:this.#id,name,text});
  const ctx=this.#context;if(!this.#activated||this.#muted||this.#paused||this.#volume===0||ctx?.state!=='running'||this.#voices.size>=8)return false;
  const osc=ctx.createOscillator(),gain=ctx.createGain();let done=false;
  const voice={stop:()=>{if(done)return;done=true;try{osc.stop();}catch{}try{osc.disconnect();gain.disconnect();}catch{}this.#voices.delete(voice);}};
  try{osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(this.#volume*0.12,ctx.currentTime);gain.gain.linearRampToValueAtTime(0,ctx.currentTime+duration);osc.connect(gain);gain.connect(ctx.destination);this.#voices.add(voice);osc.onended=voice.stop;osc.start();osc.stop(ctx.currentTime+duration);return true;}
  catch(e){voice.stop();throw e;}
 }
 pause(){this.#check();this.#paused=true;this.#stop();}
 resume(){this.#check();this.#paused=false;}
 async dispose(){if(this.#disposed)return;this.#disposed=true;this.#stop();const ctx=this.#context;this.#context=null;if(ctx)await ctx.close();}
}
