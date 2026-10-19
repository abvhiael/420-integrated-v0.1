// ARC-1.6 — an intentionally unprivileged, per-game input surface.
// Consumers call poll() from their qualified game loop; no global keyboard interception.
const ACTIONS=Object.freeze(['up','down','left','right','primary','secondary','pause']);
const KEYS=Object.freeze({ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'primary',Enter:'primary',ShiftLeft:'secondary',ShiftRight:'secondary',Escape:'pause',KeyP:'pause'});
const BUTTONS=Object.freeze({0:'primary',1:'secondary',9:'pause',12:'up',13:'down',14:'left',15:'right'});
const VALID=new Set(ACTIONS);
const SAFE_ID=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
export class InputBoundaryError extends Error {constructor(message){super(message);this.name='InputBoundaryError';}}
function permitted(target,root){return target===root||!!root.contains?.(target);}
function focused(root,owner){return permitted(owner.activeElement,root);}
export class ArcadeInput {
 #root;#owner;#navigator;#keyboard=new Set();#pointer=new Map();#gamepad=new Set();#enabled=false;#disposed=false;#listeners=[];#selectedIndex=null;#deadzone;#gameId;#onChange;
 constructor({gameId,root,document:owner,navigator:nav,onChange=()=>{},deadzone=0.25}){
  if(typeof gameId!=='string'||!SAFE_ID.test(gameId))throw new InputBoundaryError('Invalid game scope');
  if(!root||typeof root.addEventListener!=='function'||typeof root.removeEventListener!=='function'||!owner||typeof owner.addEventListener!=='function'||typeof owner.removeEventListener!=='function')throw new TypeError('DOM input hosts required');
  if(typeof onChange!=='function'||!Number.isFinite(deadzone)||deadzone<0.1||deadzone>0.9)throw new TypeError('Invalid input options');
  this.#root=root;this.#owner=owner;this.#navigator=nav;this.#onChange=onChange;this.#deadzone=deadzone;this.#gameId=gameId;
  const listen=(node,type,fn)=>{node.addEventListener(type,fn);this.#listeners.push(()=>node.removeEventListener(type,fn));};
  listen(root,'keydown',e=>{if(!this.#active()||!focused(root,owner)||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.isComposing||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName??'')||e.target?.isContentEditable)return;const action=KEYS[e.code];if(!action)return;this.#keyboard.add(action);e.preventDefault?.();this.#emit();});
  listen(root,'keyup',e=>{const action=KEYS[e.code];if(action&&this.#keyboard.delete(action)){e.preventDefault?.();this.#emit();}});
  const down=e=>{if(!this.#active()||!permitted(e.target,root))return;const action=e.target?.closest?.('[data-arcade-action]')?.getAttribute?.('data-arcade-action');if(!VALID.has(action)||!permitted(e.target,root))return;this.#pointer.set(e.pointerId,action);e.target.setPointerCapture?.(e.pointerId);e.preventDefault?.();this.#emit();};
  const up=e=>{if(this.#pointer.delete(e.pointerId))this.#emit();};
  listen(root,'pointerdown',down);for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(root,event,up);
  listen(owner,'visibilitychange',()=>{if(owner.hidden)this.clear();});
  listen(owner,'focusout',e=>{if(permitted(e.target,root)&&!permitted(e.relatedTarget,root))this.clear();});
  listen(owner,'gamepaddisconnected',e=>{if(e.gamepad?.index===this.#selectedIndex){this.#selectedIndex=null;this.#gamepad.clear();this.#emit();}});
 }
 get gameId(){return this.#gameId;}
 get enabled(){return this.#enabled&&!this.#disposed;}
 #active(){return this.#enabled&&!this.#disposed;}
 #emit(){if(this.#active())this.#onChange(this.snapshot());}
 enable(){if(this.#disposed)throw new InputBoundaryError('Input disposed');this.#enabled=true;}
 disable(){if(this.#disposed)return;this.clear();this.#enabled=false;}
 clear(){this.#keyboard.clear();this.#pointer.clear();this.#gamepad.clear();this.#emit();}
 snapshot(){const keys=new Set(this.#active()?[...this.#keyboard,...this.#pointer.values(),...this.#gamepad]:[]);return Object.freeze({gameId:this.#gameId,actions:Object.freeze(ACTIONS.filter(a=>keys.has(a)))});}
 poll(){
  if(!this.#active())return this.snapshot();
  const pads=this.#navigator?.getGamepads?.();
  const list=pads?Array.from(pads).filter(p=>p&&p.connected):[];
  let selected=list.find(p=>p.index===this.#selectedIndex);
  if(!selected){selected=list[0];this.#selectedIndex=selected?.index??null;}
  const next=new Set();
  if(selected){
   for(const [i,a] of Object.entries(BUTTONS))if(selected.buttons?.[Number(i)]?.pressed===true)next.add(a);
   const ax=selected.axes??[];
   if(Number.isFinite(ax[0])){if(ax[0]<-this.#deadzone)next.add('left');if(ax[0]>this.#deadzone)next.add('right');}
   if(Number.isFinite(ax[1])){if(ax[1]<-this.#deadzone)next.add('up');if(ax[1]>this.#deadzone)next.add('down');}
  }
  const changed=next.size!==this.#gamepad.size||[...next].some(x=>!this.#gamepad.has(x));
  this.#gamepad=next;if(changed)this.#emit();return this.snapshot();
 }
 dispose(){if(this.#disposed)return;this.disable();this.#disposed=true;for(const off of this.#listeners.splice(0))off();}
}
export const INPUT_ACTIONS=ACTIONS;
