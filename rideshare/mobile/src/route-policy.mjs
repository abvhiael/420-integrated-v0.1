// MBL-1 navigation is local preview-only. No authentication or trip authority is implied.
export const PUBLIC='welcome';
export const roles=Object.freeze(['rider','driver']);
export const screens=Object.freeze({
  welcome:Object.freeze({role:null,title:'LIFTd Preview'}),
  rider:Object.freeze({role:'rider',title:'Rider preview'}),
  driver:Object.freeze({role:'driver',title:'Driver preview'})
});
export function routeFor(role,requested) {
  if(!roles.includes(role)) return PUBLIC;
  return requested===role?requested:PUBLIC;
}
export function previewState(role,requested) {
  const route=routeFor(role,requested);
  return Object.freeze({route,title:screens[route].title,authorized:route!==PUBLIC,networkEnabled:false,paymentsEnabled:false,dispatchEnabled:false});
}
