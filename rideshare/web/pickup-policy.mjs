// L02.3 browser-side validation only; canonical L01 Location is the routing authority.
export class PickupError extends Error {constructor(code){super(code);this.name='PickupError';this.code=code;}}
const fail=code=>{throw new PickupError(code)};
const plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
export function entry(value){
  if(!plain(value)||Reflect.ownKeys(value).some(k=>!['label','latitude','longitude','precision','source','clarification'].includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))fail('INVALID_ENTRY');
  if(typeof value.label!=='string'||value.label.trim().length<3||value.label.length>200||/[\u0000-\u001f]/.test(value.label))fail('INVALID_ADDRESS');
  if(!['manual','place','device'].includes(value.source))fail('INVALID_SOURCE');
  const hasCoordinates=value.latitude!==undefined||value.longitude!==undefined;
  if(hasCoordinates&&(!Number.isFinite(value.latitude)||!Number.isFinite(value.longitude)||Math.abs(value.latitude)>90||Math.abs(value.longitude)>180||!['exact','approximate'].includes(value.precision)))fail('INVALID_COORDINATES');
  if(!hasCoordinates&&value.precision!==undefined)fail('INVALID_PRECISION');
  if(value.clarification!==undefined&&(typeof value.clarification!=='string'||value.clarification.length>160||/[\u0000-\u001f]/.test(value.clarification)))fail('INVALID_CLARIFICATION');
  return Object.freeze({label:value.label.trim(),source:value.source,...(hasCoordinates?{latitude:value.latitude,longitude:value.longitude,precision:value.precision}:{}),clarification:(value.clarification||'').trim()});
}
export function previewInput(pickup,destination){
  const a=entry(pickup),z=entry(destination);
  if(a.label===z.label&&a.latitude===z.latitude&&a.longitude===z.longitude)fail('SAME_PICKUP_DESTINATION');
  if(a.latitude===undefined||z.latitude===undefined) return Object.freeze({kind:'needs-resolution',pickup:a,destination:z});
  return Object.freeze({kind:'ready',pickup:a,destination:z,routePayload:{pickup:{latitude:a.latitude,longitude:a.longitude,precision:a.precision},dropoff:{latitude:z.latitude,longitude:z.longitude,precision:z.precision},passengerCount:1}});
}
export function validateSuggestions(list){
  if(!Array.isArray(list)||list.length>10)fail('INVALID_RESULTS');
  return Object.freeze(list.map(x=>entry(x)));
}
export function routeDescriptor(value){
  if(!plain(value)||typeof value.routeRef!=='string'||!Number.isSafeInteger(value.distanceMeters)||value.distanceMeters<0||!Number.isSafeInteger(value.durationSeconds)||value.durationSeconds<0)fail('INVALID_ROUTE');
  return Object.freeze({routeRef:value.routeRef,distanceMeters:value.distanceMeters,durationSeconds:value.durationSeconds});
}
