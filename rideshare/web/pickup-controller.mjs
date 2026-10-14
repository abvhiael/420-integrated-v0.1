import {entry,previewInput,validateSuggestions,routeDescriptor,PickupError} from './pickup-policy.mjs';
// Explicit permission only: the controller never calls device geolocation automatically.
export function createPickupController({search,geolocate,resolveAddress,prepareRoute}={}){
 let version=0,consent=false,selection={pickup:null,destination:null};
 const required=fn=>{if(typeof fn!=='function')throw new PickupError('PROVIDER_UNAVAILABLE');return fn;};
 return Object.freeze({
  permission(){return consent;},
  async requestLocationPermission(){
    // Calling this method is an explicit UI action, not page-load telemetry.
    const action=required(geolocate);consent=true;
    try{return entry({...await action(),source:'device'});}
    catch{consent=false;throw new PickupError('LOCATION_UNAVAILABLE');}
  },
  async suggestions(text){
    if(typeof text!=='string'||text.trim().length<3||text.length>200)throw new PickupError('INVALID_QUERY');
    const ticket=++version;
    try{
      const data=validateSuggestions(await required(search)(text.trim()));
      if(ticket!==version)throw new PickupError('STALE_RESULTS');
      return data;
    }catch(e){if(e instanceof PickupError)throw e;throw new PickupError('SEARCH_UNAVAILABLE');}
  },
  cancelPending(){++version;},
  set(which,value){
    if(!['pickup','destination'].includes(which))throw new PickupError('INVALID_FIELD');
    selection={...selection,[which]:entry(value)};return selection[which];
  },
  async preview(){
    const p=previewInput(selection.pickup,selection.destination);
    let a=p.pickup,z=p.destination;
    try{
      if(a.latitude===undefined)a=entry({...await required(resolveAddress)(a),source:'place',clarification:a.clarification});
      if(z.latitude===undefined)z=entry({...await required(resolveAddress)(z),source:'place',clarification:z.clarification});
      const valid=previewInput(a,z);
      if(valid.kind!=='ready')throw new PickupError('RESOLUTION_REQUIRED');
      return routeDescriptor(await required(prepareRoute)(valid.routePayload));
    }catch(e){if(e instanceof PickupError)throw e;throw new PickupError('ROUTE_UNAVAILABLE');}
  }
 });
}
