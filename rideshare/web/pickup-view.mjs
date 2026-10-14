import {createPickupController} from './pickup-controller.mjs';
export function mountPickupView(container, session, providers={}, onRoutePreview=undefined){
 let active=true,sequence=0;
 const controller=createPickupController(providers), panel=document.createElement('section');
 panel.className='panel';panel.setAttribute('aria-label','Pickup and destination');
 const heading=document.createElement('h2');heading.textContent='Pickup & destination';
 const hint=document.createElement('p');hint.textContent='Vancouver preview only. Location access is optional. No vehicles, fares or bookings are available.';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(heading,hint,status);const form=document.createElement('form');panel.append(form);
 const entries={};
 for(const [name,title] of [['pickup','Pickup'],['destination','Destination']]){
  const group=document.createElement('div');const label=document.createElement('label');label.textContent=title+' address or place';
  const field=document.createElement('input');field.type='search';field.minLength=3;field.maxLength=200;field.required=true;field.autocomplete='off';
  label.append(field);group.append(label);
  const clarification=document.createElement('label');clarification.textContent=name==='pickup'?'Pickup clarification (entrance or landmark)':'Arrival clarification';
  const extra=document.createElement('input');extra.type='text';extra.maxLength=160;clarification.append(extra);group.append(clarification);
  const search=document.createElement('button');search.type='button';search.textContent='Search places';
  const results=document.createElement('div');results.setAttribute('role','group');results.setAttribute('aria-label',title+' suggestions');
  search.addEventListener('click',async()=>{
    const ticket=++sequence;results.replaceChildren();status.textContent='Searching places…';
    try{const found=await controller.suggestions(field.value);if(!active||ticket!==sequence)return;
      if(!found.length)status.textContent='No results. You can still enter the address manually.';
      else {status.textContent='Select a place or continue with manual entry.';for(const location of found){
        const choice=document.createElement('button');choice.type='button';choice.textContent=location.label;
        choice.addEventListener('click',()=>{field.value=location.label;entries[name].selected=location;results.replaceChildren();status.textContent='Place selected. Confirm pickup details before continuing.';});
        results.append(choice);
      }}
    }catch{if(active&&ticket===sequence)status.textContent='Place search unavailable. Manual entry remains available.';}
  });group.append(search,results);form.append(group);entries[name]={field,extra,selected:null};
  field.addEventListener('input',()=>{entries[name].selected=null;controller.cancelPending();results.replaceChildren();});
 }
 const geo=document.createElement('button');geo.type='button';geo.textContent='Use my current location (optional)';
 geo.addEventListener('click',async()=>{
  status.textContent='Requesting location permission…';
  try{const place=await controller.requestLocationPermission();if(!active)return;
    entries.pickup.selected=place;entries.pickup.field.value=place.label;status.textContent='Location received. Please clarify the pickup point.';
  }catch{if(active)status.textContent='Location unavailable or denied. Enter pickup manually instead.';}
 });
 form.append(geo);
 const preview=document.createElement('button');preview.type='submit';preview.textContent='Preview route';
 form.append(preview);
 form.addEventListener('submit',async event=>{
  event.preventDefault();status.textContent='Checking route…';preview.disabled=true;
  try{
   for(const name of ['pickup','destination']){
    const {field,extra,selected}=entries[name];
    const data=selected&&selected.label===field.value?{...selected,clarification:extra.value}:{label:field.value,source:'manual',clarification:extra.value};
    controller.set(name,data);
   }
   const result=await controller.preview();if(!active)return;
   status.textContent='Route reference '+result.routeRef+': '+Math.round(result.distanceMeters/100)/10+' km, about '+Math.ceil(result.durationSeconds/60)+' minutes. This is not a booking or fare quote.';
   if(typeof onRoutePreview==='function')await onRoutePreview(result);
  }catch{if(active)status.textContent='Route unavailable or pickup needs clarification. Check addresses, try another location or use manual entry.';}
  finally{if(active)preview.disabled=false;}
 });
 container.append(panel);return()=>{active=false;sequence++;controller.cancelPending();panel.remove();};
}
