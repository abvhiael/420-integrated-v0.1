// Accessible district navigation for the Port Alder town overview.
// All destinations come from the versioned public navigation contract.
export async function mountPortAlderNavigation({document,main,pathname,fetchImpl=fetch}){
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
 const status=el('p','Loading Port Alder district navigation…');status.setAttribute('role','status');main.append(status);
 try{
  const response=await fetchImpl('/assets/highcountry/maps/hc-world-06-port-alder-district-navigation.v1.json');
  if(!response.ok)throw Error('map data unavailable');
  const map=await response.json();
  if(map.schema!=='HC.WORLD.PORT.ALDER.DISTRICT.NAV.V1'||map.ownershipAuthority!=='NONE_NAVIGATION_ONLY')throw Error('invalid navigation contract');
  const parts=pathname.split('/'),selected=parts[3]?map.districts.find(d=>d.id===decodeURIComponent(parts[3])):null;
  if(parts[3]&&!selected)throw Error('unknown district');
  status.textContent=selected?'Port Alder / '+selected.label:'Select a Port Alder district';
  const note=el('p','Genesis navigation preview. Neighbourhood maps, property titles and county exits are not yet active.');main.append(note);
  const a=(label,href)=>{const link=el('a',label);link.href=href;return link};
  if(selected){
   main.append(el('p','Neighbourhood scene ID: '+selected.sceneId),el('p','Entry tile: '+selected.entrance.join(', ')));
   main.append(a('Return to Port Alder overview','/port-alder'));
   const nav=el('nav','');nav.setAttribute('aria-label','Adjacent neighbourhoods');
   for(const id of selected.neighbours){const d=map.districts.find(x=>x.id===id);if(d){const line=el('p','');line.append(a(d.label,'/port-alder/district/'+encodeURIComponent(d.id)));nav.append(line)}}
   main.append(nav);
  }else{
   const nav=el('nav','');nav.setAttribute('aria-label','Port Alder district destinations');
   for(const d of map.districts){const line=el('p','');line.append(a(d.label,'/port-alder/district/'+encodeURIComponent(d.id)));nav.append(line)}
   main.append(nav);
  }
 }catch(e){status.textContent='District navigation unavailable: '+e.message;status.setAttribute('role','alert')}
}
