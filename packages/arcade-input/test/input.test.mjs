import test from 'node:test';import assert from 'node:assert/strict';import {ArcadeInput,InputBoundaryError,INPUT_ACTIONS} from '../src/index.mjs';
const id='420/GAMING/GAME/ARCADE_BONG_BREAKER/V1';
class Host extends EventTarget{constructor(){super();this.activeElement=null;this.hidden=false;}contains(node){return node===this||node?.parent===this;}}
const fire=(host,type,props={})=>{const e=new Event(type,{cancelable:true});const {target,...rest}=props;Object.assign(e,rest);if(target!==undefined)Object.defineProperty(e,'target',{value:target,configurable:true});host.dispatchEvent(e);return e;};
function make(){const root=new Host(),doc=new Host(),navigator={getGamepads:()=>[]};doc.activeElement=root;const changes=[];const input=new ArcadeInput({gameId:id,root,document:doc,navigator,onChange:s=>changes.push(s)});input.enable();return {root,doc,navigator,input,changes};}
test('keyboard scope, focus gating, modifiers, editable fields and key release',()=>{
 const {root,doc,input}=make();
 const e=fire(root,'keydown',{code:'ArrowLeft',target:root});assert.equal(e.defaultPrevented,true);assert.deepEqual(input.snapshot().actions,['left']);
 fire(root,'keyup',{code:'ArrowLeft'});assert.deepEqual(input.snapshot().actions,[]);
 fire(root,'keydown',{code:'Space',ctrlKey:true,target:root});assert.deepEqual(input.snapshot().actions,[]);
 fire(root,'keydown',{code:'Space',target:{tagName:'INPUT'}});assert.deepEqual(input.snapshot().actions,[]);
 doc.activeElement={};fire(root,'keydown',{code:'ArrowUp',target:root});assert.deepEqual(input.snapshot().actions,[]);
 doc.activeElement=root;fire(root,'keydown',{code:'KeyP',target:root});assert.deepEqual(input.snapshot().actions,['pause']);input.dispose();
});
test('touch pointer capture, multi-touch, cancel and unknown action rejection',()=>{
 const {root,input}=make();const element={parent:root,getAttribute:()=> 'left',closest:()=>element,setPointerCapture(){}};
 fire(root,'pointerdown',{target:element,pointerId:1});assert.deepEqual(input.snapshot().actions,['left']);
 const second={...element,getAttribute:()=> 'primary',closest:()=>second};
 fire(root,'pointerdown',{target:second,pointerId:2});assert.deepEqual(input.snapshot().actions,['left','primary']);
 fire(root,'pointercancel',{pointerId:1});assert.deepEqual(input.snapshot().actions,['primary']);fire(root,'pointerup',{pointerId:2});assert.deepEqual(input.snapshot().actions,[]);
 const bad={...element,getAttribute:()=> 'eval',closest:()=>bad};fire(root,'pointerdown',{target:bad,pointerId:3});assert.deepEqual(input.snapshot().actions,[]);input.dispose();
});
test('gamepad deadzone, buttons, disconnect, no hardware and disabled mode',()=>{
 const {root,doc,navigator,input}=make();const pad={index:0,connected:true,axes:[0.8,-0.7],buttons:Array.from({length:16},()=>({pressed:false}))};pad.buttons[0].pressed=true;navigator.getGamepads=()=>[pad];assert.deepEqual(input.poll().actions,['up','right','primary']);
 pad.axes=[0.02,0.03];pad.buttons[0].pressed=false;assert.deepEqual(input.poll().actions,[]);
 pad.buttons[9].pressed=true;assert.deepEqual(input.poll().actions,['pause']);fire(doc,'gamepaddisconnected',{gamepad:{index:0}});navigator.getGamepads=()=>[];assert.deepEqual(input.poll().actions,[]);
 fire(root,'keydown',{code:'KeyA',target:root});input.disable();assert.deepEqual(input.poll().actions,[]);input.dispose();
});
test('visibility and focus exit release held inputs; dispose detaches, never reactivates',()=>{
 const {root,doc,input}=make();fire(root,'keydown',{code:'KeyW',target:root});doc.hidden=true;fire(doc,'visibilitychange');assert.deepEqual(input.snapshot().actions,[]);
 doc.hidden=false;fire(root,'keydown',{code:'KeyW',target:root});fire(doc,'focusout',{target:root,relatedTarget:{}});assert.deepEqual(input.snapshot().actions,[]);
 input.dispose();input.dispose();fire(root,'keydown',{code:'KeyW',target:root});assert.deepEqual(input.snapshot().actions,[]);assert.throws(()=>input.enable(),InputBoundaryError);
});
test('invalid game identity and options fail closed',()=>{
 const {root,doc}=make();
 for(const gameId of ['foreign','420/GAMING/GAME/../../BAD/V1',''])assert.throws(()=>new ArcadeInput({gameId,root,document:doc}),InputBoundaryError);
 for(const deadzone of [0,1,NaN])assert.throws(()=>new ArcadeInput({gameId:id,root,document:doc,deadzone}),TypeError);
 assert.deepEqual(INPUT_ACTIONS,['up','down','left','right','primary','secondary','pause']);
});
