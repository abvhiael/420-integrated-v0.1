const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=['healthy','degraded','unavailable','maintenance','unknown'];
const stateClass=s=>states.includes(String(s))?String(s):'unknown';
const label=s=>String(s||'unknown').replace(/_/g,' ');

async function getJSON(path){
  const r=await fetch(path,{headers:{accept:'application/json'},cache:'no-store'});
  if(!r.ok)throw new Error(r.status===503?'live status backend is not connected yet':path+' returned '+r.status);
  const body=await r.json();
  if(body.canonical!==false)throw new Error(path+' did not explicitly declare canonical:false');
  return body;
}

function metric(text){return '<span>'+esc(text)+'</span>'}

function renderComponents(items){
  const list=items||[];
  $('components').innerHTML=list.map(s=>{
    const c=s.Component||{};
    const health=stateClass(s.Health);
    const fresh=Number(s.FreshSources||0),stale=Number(s.StaleSources||0);
    const sourceText=fresh?fresh+' fresh source'+(fresh===1?'':'s'):(stale?stale+' stale source'+(stale===1?'':'s'):'no fresh evidence');
    return '<article class="component-card '+health+'">'+
      '<div class="card-top"><div><h3>'+esc(c.Name||c.ID||'Component')+'</h3><div class="component-class">'+esc(c.Class||'service')+'</div></div><span class="status-pill">'+esc(label(health))+'</span></div>'+
      '<p class="reason">'+esc(s.Reason||'No additional status detail.')+'</p>'+
      '<div class="metrics">'+metric(s.Live?'live':'not live')+metric(s.Ready?'ready':'not ready')+metric(sourceText)+(s.Conflicting?metric('conflicting evidence'):'')+'</div></article>';
  }).join('')||'<p class="empty">No public components are currently reported.</p>';
  const healthy=list.filter(x=>stateClass(x.Health)==='healthy').length;
  $('component-summary').textContent=list.length?healthy+' of '+list.length+' healthy':'No components reported';
}

function renderIncident(i){
  const last=(i.updates||[]).at(-1)||{};
  const affected=(i.affected_components||[]).join(', ');
  const refs=(last.evidence||[]).map(r=>esc(r.Kind||r.kind)+': '+esc(r.Value||r.value)).join('<br>');
  return '<article class="event"><div class="event-state">'+esc(last.severity||'INFO')+' · '+esc(last.state||'open')+'</div><h3>'+esc(i.title||i.id)+'</h3><p>'+esc(last.summary||'')+'</p><p class="meta">Affected: '+esc(affected||'public service')+'</p>'+(refs?'<p class="refs">'+refs+'</p>':'')+'</article>';
}

function renderFeed(id,items,empty,countId){
  const list=items||[];
  $(id).innerHTML=list.map(renderIncident).join('')||'<p class="empty">'+esc(empty)+'</p>';
  $(countId).textContent=String(list.length);
}

function renderHistory(items,append=false){
  const html=(items||[]).map(x=>{
    if(x.observation){
      const o=x.observation;
      const refs=(o.references||[]).map(r=>esc(r.Kind||r.kind)+': '+esc(r.Value||r.value)).join('<br>');
      return '<article class="event"><div class="event-state">observation · '+esc(o.state)+'</div><h3>'+esc(o.component_id)+' via '+esc(o.source_id)+'</h3><p class="meta">Observed '+esc(new Date(o.observed_at).toLocaleString())+' · expires '+esc(new Date(o.expires_at).toLocaleString())+'</p>'+(refs?'<p class="refs">'+refs+'</p>':'')+'</article>';
    }
    return x.incident?renderIncident(x.incident):'';
  }).join('');
  if(append)$('history').insertAdjacentHTML('beforeend',html);
  else $('history').innerHTML=html||'<p class="empty">No public history yet.</p>';
}

let nextCursor='';
async function loadHistory(append=false){
  const path='/v1/history?limit=25'+(append&&nextCursor?'&cursor='+encodeURIComponent(nextCursor):'');
  const body=await getJSON(path);
  renderHistory(body.items,append);
  nextCursor=body.next_cursor||'';
  $('load-more').hidden=!nextCursor;
}

function setConnectionError(message){
  $('connection-card').hidden=false;
  $('error').textContent='The website is online, but '+message+'.';
  $('network-banner').className='network-badge unavailable';
  $('network-state-label').textContent='Status data unavailable';
  $('updated-at').textContent='No fresh operational evidence';
  $('component-summary').textContent='Backend unavailable';
  $('components').innerHTML='<p class="empty">Live component data will appear here when the 420Status service is connected.</p>';
  $('incidents').innerHTML='<p class="empty">Incident data unavailable.</p>';
  $('maintenance').innerHTML='<p class="empty">Maintenance data unavailable.</p>';
  $('history').innerHTML='<p class="empty">History data unavailable.</p>';
  $('incident-count').textContent='—';
  $('maintenance-count').textContent='—';
}

async function boot(){
  $('connection-card').hidden=true;
  try{
    const [status,incidents,maintenance]=await Promise.all([
      getJSON('/v1/status'),
      getJSON('/v1/incidents'),
      getJSON('/v1/maintenance')
    ]);
    const health=stateClass(status.health);
    $('network-banner').className='network-badge '+health;
    $('network-state-label').textContent='Network '+label(health);
    $('updated-at').textContent='Viewed '+new Date().toLocaleString();
    renderComponents(status.components);
    renderFeed('incidents',incidents.incidents,'No active public incidents.','incident-count');
    renderFeed('maintenance',maintenance.maintenance,'No planned public maintenance.','maintenance-count');
    await loadHistory(false);
  }catch(err){
    setConnectionError(err.message);
  }
}

$('load-more').addEventListener('click',()=>loadHistory(true).catch(err=>setConnectionError(err.message)));
$('retry').addEventListener('click',boot);
boot();
