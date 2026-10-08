const MAX=500;
export function normalize(payload){
 if(!payload||payload.version!=="v1"||!payload.data||!Array.isArray(payload.data.items))throw Error("Invalid public source");
 const {items,empty}=payload.data;
 if(items.length>MAX||empty!==(items.length===0))throw Error("Invalid public source");
 const ids=new Set();
 return items.map(item=>{
  if(!item||typeof item.id!=="string"||!item.id.trim()||ids.has(item.id)||typeof item.name!=="string"||!item.name.trim()||typeof item.source!=="string"||!item.source.trim()||!["FARM","BUSINESS","VENUE","ATTRACTION","DISPENSARY","HOTEL","RENTAL","RESTAURANT","EVENT_LOCATION","SERVICE_PROVIDER","OTHER"].includes(item.category))throw Error("Invalid public source");
  ids.add(item.id);
  if(!["pin","area"].includes(item.kind))throw Error("Invalid public source");
  if(item.kind==="area"){
   if(item.latitude!=null||item.longitude!=null||![item.city,item.region,item.country].some(x=>typeof x==="string"&&x.trim()))throw Error("Invalid public source");
  }else if(typeof item.latitude!=="number"||typeof item.longitude!=="number"||!Number.isFinite(item.latitude)||!Number.isFinite(item.longitude)||Math.abs(item.latitude)>90||Math.abs(item.longitude)>180)throw Error("Invalid public source");
  return {id:item.id,name:item.name,source:item.source,registryRecordId:typeof item.registryRecordId==="string"?item.registryRecordId:"",category:item.category,kind:item.kind,latitude:item.kind==="pin"?item.latitude:null,longitude:item.kind==="pin"?item.longitude:null,city:typeof item.city==="string"?item.city:"",region:typeof item.region==="string"?item.region:"",country:typeof item.country==="string"?item.country:""};
 }).filter(item=>item.category==="FARM"||item.category==="BUSINESS");
}
export function configOrigin(config, pageOrigin){
 if(!config||config.enabled!==true||typeof config.locationBaseUrl!=="string"||!config.locationBaseUrl)return null;
 let url;try{url=new URL(config.locationBaseUrl)}catch{return null}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return null;
 if(url.origin!==pageOrigin&&!config.crossOriginApproved)return null;
 return url.origin;
}
export function filterPlaces(items,category,query){
 const needle=query.trim().toLocaleLowerCase();
 return items.filter(p=>(category==="ALL"||p.category===category)&&[p.name,p.city,p.region,p.country].some(s=>s.toLocaleLowerCase().includes(needle)));
}
export function routeURL(place){
 if(place?.kind!=="pin"||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))return null;
 const q=encodeURIComponent(place.latitude+","+place.longitude);
 return "https://www.openstreetmap.org/?mlat="+encodeURIComponent(place.latitude)+"&mlon="+encodeURIComponent(place.longitude)+"#map=12/"+q.replace("%2C","/");
}
export async function loadPlaces(config,pageOrigin,fetcher=fetch){
 const origin=configOrigin(config,pageOrigin);if(!origin)throw Error("Not configured");
 const response=await fetcher(origin+"/v1/places",{method:"GET",headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000),credentials:"omit",redirect:"error",cache:"no-store"});
 if(!response.ok||!response.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw Error("Public source unavailable");
 const raw=await response.text();if(raw.length>2097152)throw Error("Public source unavailable");
 return normalize(JSON.parse(raw));
}
export function boot(doc=globalThis.document,win=globalThis.window){
 if(!doc||!win)return;
 const el=id=>doc.getElementById(id);let items=[],category="ALL",mode="list",selected=null;
 const setStatus=s=>{el("status").textContent=s;};
 function detail(item){
  const dest=el("detail");dest.replaceChildren();dest.hidden=false;
  const h=doc.createElement("h3");h.textContent=item.name;dest.append(h);
  const dl=doc.createElement("dl");
  for(const [label,value] of [["Category",item.category],["Location",[item.city,item.region,item.country].filter(Boolean).join(", ")||"Public coordinate only"],["Precision",item.kind==="pin"?"Public exact location":"Approximate region"],["Place ID",item.id],["Source",item.source],["Registry reference",item.registryRecordId||"Not provided"],["Verification","Not independently verified"]]){
   const dt=doc.createElement("dt"),dd=doc.createElement("dd");dt.textContent=label;dd.textContent=value;dl.append(dt,dd);
  }dest.append(dl);
  const url=routeURL(item);if(url){const link=doc.createElement("a");link.href=url;link.rel="noopener noreferrer";link.target="_blank";link.textContent="View public point on OpenStreetMap ↗";dest.append(link);}
  const close=doc.createElement("button");close.type="button";close.textContent="Close details";close.addEventListener("click",()=>{dest.hidden=true;selected=null;el("results").focus();});dest.append(close);
  dest.scrollIntoView({block:"nearest",behavior:"auto"});
 }
 function render(){
  const shown=filterPlaces(items,category,el("search").value);const root=el("results");root.replaceChildren();root.tabIndex=-1;
  if(!shown.length){setStatus(items.length?"No matching public places.":"No public farm or business places returned.");return;}
  setStatus(shown.length+" public "+(shown.length===1?"place":"places")+" · source: 420Location");
  if(mode==="map"){
   const wrap=doc.createElement("div");wrap.className="map-panel";const note=doc.createElement("p");note.textContent="Public coordinates are plotted schematically, not on map tiles. Approximate regions appear only in the list below.";wrap.append(note);
   const frame=doc.createElement("div");frame.className="map-frame";frame.setAttribute("role","group");frame.setAttribute("aria-label","Public point map, approximate positions");
   for(const p of shown.filter(p=>p.kind==="pin")){const pin=doc.createElement("button");pin.type="button";pin.className="map-pin";pin.textContent=p.name;pin.style.left=(5+(p.longitude+180)/360*90)+"%";pin.style.top=(5+(90-p.latitude)/180*90)+"%";pin.addEventListener("click",()=>detail(p));frame.append(pin);}
   wrap.append(frame);const areas=shown.filter(p=>p.kind==="area");if(areas.length){const list=doc.createElement("ul");list.className="area-list";for(const p of areas){const li=doc.createElement("li"),button=doc.createElement("button");button.type="button";button.textContent=p.name+" — "+[p.city,p.region,p.country].filter(Boolean).join(", ");button.addEventListener("click",()=>detail(p));li.append(button);list.append(li);}wrap.append(list);}root.append(wrap);
  }else for(const p of shown){const card=doc.createElement("button");card.type="button";card.className="place";const tag=doc.createElement("small");tag.textContent=p.category+" / "+(p.kind==="pin"?"PUBLIC POINT":"APPROXIMATE REGION");const h=doc.createElement("h3");h.textContent=p.name;const geo=doc.createElement("p");geo.textContent=[p.city,p.region,p.country].filter(Boolean).join(", ")||"Public point";const source=doc.createElement("p");source.textContent="Source: "+p.source;card.append(tag,h,geo,source);card.addEventListener("click",()=>detail(p));root.append(card);}
 }
 async function refresh(){
  items=[];selected=null;el("detail").hidden=true;el("results").replaceChildren();setStatus("Loading public places…");
  try{items=await loadPlaces(win.GROW420_CONFIG,win.location.origin,win.fetch.bind(win));el("connection").textContent="Public source connected";render();}
  catch{el("connection").textContent="Source unavailable";el("footerStatus").textContent="No public source is currently available.";setStatus("Public places are unavailable. Check the approved 420Location endpoint and try again.");}
 }
 el("refresh").addEventListener("click",refresh);
 el("search").addEventListener("input",render);
 el("category").addEventListener("change",()=>{category=el("category").value;render();});
 for(const [id,value] of [["listToggle","list"],["mapToggle","map"]])el(id).addEventListener("click",()=>{mode=value;el("listToggle").setAttribute("aria-pressed",String(mode==="list"));el("mapToggle").setAttribute("aria-pressed",String(mode==="map"));render();});
 refresh();
}
if(typeof document!=="undefined")boot();
