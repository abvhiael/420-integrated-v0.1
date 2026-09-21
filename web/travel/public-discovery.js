/* Progressive, read-only 420Travel public discovery. No private endpoints or cookies. */
(() => {
  'use strict';
  const endpoints = {places:'/travel/api/v1/places',events:'/travel/api/v1/events'};
  const ID = /^[A-Za-z0-9_-]{1,128}$/;
  const text = (value,max=500) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  const el = (tag,content) => {const node=document.createElement(tag);if(content !== undefined)node.textContent=content;return node;};
  function check(data,kind) {
    if (!data || (data.state !== 'ready' && data.state !== 'empty') || !Array.isArray(data[kind]) || data[kind].length > 100) throw Error('Invalid public response');
    if ((data.state === 'ready') !== (data[kind].length > 0)) throw Error('Invalid public state');
    for (const item of data[kind]) {
      if (!item || !text(item.id,128) || !ID.test(item.id)) throw Error('Invalid public ID');
      if (kind === 'places') {
        if (!text(item.name) || !['category','city','region','country'].every(key=>text(item[key])) || typeof item.approximate !== 'boolean') throw Error('Invalid place');
      } else if (!text(item.title) || !text(item.starts_at,64) || Number.isNaN(Date.parse(item.starts_at)) || !['place_id','place_name','city','region'].every(key=>item[key] === undefined || text(item[key]))) throw Error('Invalid event');
    }
    return data;
  }
  async function read(kind,params={}) {
    const url=new URL(endpoints[kind],window.location.origin);
    for(const [key,value] of Object.entries(params))if(value)url.searchParams.set(key,value);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const response=await fetch(url,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:controller.signal});
      if(!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type')||''))throw Error('Public service unavailable');
      const data=await response.json();return check(data,kind);
    } finally {clearTimeout(timer);}
  }
  const discover=document.querySelector('#discover');const events=document.querySelector('#events');
  if(!discover||!events)return;
  const placeField=discover.querySelector('#destination');const placeButton=discover.querySelector('.search-controls button');const placeStatus=discover.querySelector('#discovery-unavailable');
  const eventField=events.querySelector('#event-destination');const eventDate=events.querySelector('#event-from');const eventButton=events.querySelector('.event-filter button');const eventStatus=events.querySelector('#event-unavailable');
  if(!placeField||!placeButton||!placeStatus||!eventField||!eventDate||!eventButton||!eventStatus)return;
  const placeResults=el('div');placeResults.className='public-results';placeResults.setAttribute('aria-label','Published public places');placeStatus.after(placeResults);
  const eventResults=el('div');eventResults.className='public-results';eventResults.setAttribute('aria-label','Published public events');eventStatus.after(eventResults);
  const status=(node,value)=>node.textContent=value;
  const cards=(target,items,kind)=>{
    target.replaceChildren();
    for(const item of items){
      const card=el('article');card.className='card public-result';
      card.append(el('h3',kind==='places'?item.name:item.title));
      if(kind==='places'){
        const location=[item.city,item.region,item.country].filter(Boolean).join(', ');
        card.append(el('p',[item.category,location].filter(Boolean).join(' · ')));
        if(item.approximate)card.append(el('p','Approximate area; exact coordinates are not published.'));
      }else{
        card.append(el('p',new Date(item.starts_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC'));
        card.append(el('p',[item.place_name,item.city,item.region].filter(Boolean).join(' · ') || 'No public venue specified.'));
      }
      target.append(card);
    }
  };
  const setup=async(kind,inputs,button,notice,target)=>{
    try{
      const initial=await read(kind);
      for(const input of inputs)input.disabled=false;
      button.disabled=false;
      cards(target,initial[kind],kind);
      status(notice,initial.state==='empty'?'No published '+kind+' are available right now.':'Published public '+kind+' are available. Use the filters to narrow results.');
      return true;
    }catch{status(notice,'Public '+kind+' are currently unavailable. Search remains disabled.');target.replaceChildren();return false;}
  };
  async function search(kind,inputs,button,notice,target,params){
    button.disabled=true;status(notice,'Loading currently published '+kind+'…');target.replaceChildren();
    try{const data=await read(kind,params());cards(target,data[kind],kind);status(notice,data.state==='empty'?'No published '+kind+' match your search.':data[kind].length+' published '+kind+' found.');}
    catch{status(notice,'Public '+kind+' could not be loaded. No stale results are displayed.');target.replaceChildren();}
    finally{button.disabled=false;}
  }
  setup('places',[placeField],placeButton,placeStatus,placeResults).then(ok=>{
    if(!ok)return;
    const run=()=>search('places',[placeField],placeButton,placeStatus,placeResults,()=>({destination:placeField.value.trim().slice(0,80)}));
    placeButton.addEventListener('click',run);placeField.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
  });
  setup('events',[eventField,eventDate],eventButton,eventStatus,eventResults).then(ok=>{
    if(!ok)return;
    // Go API accepts one UTC date only; the separate end-date control stays disabled.
    const run=()=>search('events',[eventField,eventDate],eventButton,eventStatus,eventResults,()=>({destination:eventField.value.trim().slice(0,80),date:eventDate.value}));
    eventButton.addEventListener('click',run);eventField.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run();}});
  });
})();
