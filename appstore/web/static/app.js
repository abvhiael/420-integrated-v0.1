const route = document.getElementById('route-content');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function getJSON(path){
  const r = await fetch(path,{headers:{'Accept':'application/json'}});
  if(!r.ok) throw new Error(`request failed (${r.status})`);
  return r.json();
}

function appCard(item){
  const c=item.curation||{};
  return `<article class="card">
    <div class="meta">${c.featured?'<span class="badge">featured</span>':''}${c.sponsored?`<span class="badge sponsored">${esc(c.sponsorLabel||'sponsored')}</span>`:''}${item.warningCount?`<span class="badge warning">${item.warningCount} warning${item.warningCount===1?'':'s'}</span>`:''}</div>
    <h2>${esc(item.serviceId)}</h2>
    <p class="muted">${esc(c.description||'Registered 420 application')}</p>
    <div class="meta">${(c.categories||[]).map(x=>`<span class="badge">${esc(x)}</span>`).join('')}</div>
    <p><strong>version ${esc(item.version)}</strong> · ${item.active?'active':'inactive'}</p>
    <a class="button" href="#/app/${encodeURIComponent(item.serviceId)}">View details</a>
  </article>`;
}

async function browse(q=''){
  route.innerHTML='<div class="panel"><p class="muted">Loading catalogue…</p></div>';
  try{
    const data=await getJSON(q?`/v1/apps/search?q=${encodeURIComponent(q)}`:'/v1/apps');
    route.innerHTML=`<div class="panel"><p class="muted">${esc(data.disclaimer||'')}</p></div><section class="section grid">${data.items?.length?data.items.map(appCard).join(''):'<div class="empty">No applications found.</div>'}</section>`;
  }catch(e){route.innerHTML=`<div class="panel"><h2>Catalogue unavailable</h2><p class="muted">${esc(e.message)}. Direct Registry, Explorer, Wallet and application access remain independent of AppStore availability.</p></div>`}
}

async function categories(){
  try{
    const data=await getJSON('/v1/apps/categories');
    route.innerHTML=`<div class="panel"><h2>Categories</h2><div class="meta">${(data.categories||[]).map(c=>`<a class="badge" href="#/category/${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div><p class="muted">${esc(data.disclaimer||'')}</p></div>`;
  }catch(e){route.innerHTML=`<div class="panel"><p class="muted">${esc(e.message)}</p></div>`}
}

async function category(name){
  const data=await getJSON(`/v1/apps?category=${encodeURIComponent(name)}`);
  route.innerHTML=`<div class="panel"><h2>${esc(name)}</h2></div><section class="section grid">${data.items?.length?data.items.map(appCard).join(''):'<div class="empty">No applications in this category.</div>'}</section>`;
}

function evidenceList(sec){
  const all=sec?.evidence||[];
  if(!all.length) return '<p class="muted">No published security evidence.</p>';
  return `<div class="grid">${all.map(e=>`<article class="card"><div class="meta"><span class="badge ${e.severity==='CRITICAL'||e.severity==='WARNING'?'warning':''}">${esc(e.severity)}</span><span class="badge">${esc(e.kind)}</span></div><h3>${esc(e.status)}</h3><p>${esc(e.summary||'')}</p><p class="muted">source: ${esc(e.source)}</p><p class="muted">reference: ${esc(e.reference)}</p></article>`).join('')}</div>`;
}

async function detail(id){
  route.innerHTML='<div class="panel"><p class="muted">Loading application…</p></div>';
  try{
    const data=await getJSON(`/v1/apps/${id.split('/').map(encodeURIComponent).join('/')}`);
    const a=data.application, r=a.listing.canonical, c=a.listing.curation||{}, w=a.wallet||{}, l=a.links||{};
    route.innerHTML=`
      <section class="panel">
        <div class="meta">${c.featured?'<span class="badge">featured</span>':''}${c.sponsored?`<span class="badge sponsored">${esc(c.sponsorLabel||'sponsored')}</span>`:''}${!r.active?'<span class="badge warning">inactive</span>':''}</div>
        <h2>${esc(r.serviceId)}</h2><p>${esc(c.description||'')}</p>
        <p class="muted">Catalogue presentation is non-canonical. Registry and chain provenance below are canonical source references.</p>
        <div class="links">${l.registry?`<a href="${esc(l.registry)}" rel="noreferrer">Registry</a>`:''}${l.explorer?`<a href="${esc(l.explorer)}" rel="noreferrer">Explorer</a>`:''}${l.verify?`<a href="${esc(l.verify)}" rel="noreferrer">Verify</a>`:''}${l.direct?`<a href="${esc(l.direct)}" rel="noreferrer">Direct app</a>`:''}</div>
      </section>
      <section class="section panel"><h3>Canonical contract & version</h3><dl class="kv"><dt>service</dt><dd>${esc(r.serviceId)}</dd><dt>version</dt><dd>${esc(r.version)}</dd><dt>implementation</dt><dd>${esc(r.implementation)}</dd><dt>code hash</dt><dd>${esc(r.codeHash)}</dd><dt>metadata hash</dt><dd>${esc(r.metadataHash)}</dd><dt>block</dt><dd>${esc(r.blockNumber)}</dd></dl></section>
      <section class="section panel"><h3>Permissions & capability scopes</h3>${(w.permissions||[]).length?`<div class="grid">${w.permissions.map(p=>`<div class="card"><strong>${esc(p.name)}</strong><p>${esc(p.description||'')}</p>${p.highRisk?'<span class="badge warning">high risk</span>':''}</div>`).join('')}</div>`:'<p class="muted">No requested permissions published.</p>'}${(w.capabilities||[]).length?`<div class="grid section">${w.capabilities.map(c=>`<div class="card"><strong>${esc(c.capability)}</strong><p>${esc(c.scope)}</p>${c.highRisk?'<span class="badge warning">high risk</span>':''}</div>`).join('')}</div>`:''}<p class="muted">Authorization boundary: ${esc(w.authorizationBoundary||'420Wallet/Smart Accounts')}</p></section>
      <section class="section panel"><h3>Security evidence & warnings</h3>${evidenceList(a.security)}<p class="muted">${esc(a.security?.disclaimer||'')}</p></section>
      <section class="section panel"><h3>Open in 420Wallet</h3><p class="muted">AppStore passes context only. Wallet/Smart Accounts retain signing and authorization control.</p>${w.uri?`<a class="button" href="${esc(w.uri)}">Open in 420Wallet</a>`:'<p class="muted">Wallet handoff unavailable.</p>'}</section>`;
  }catch(e){route.innerHTML=`<div class="panel"><h2>Application unavailable</h2><p class="muted">${esc(e.message)}</p></div>`}
}

function staticPage(kind){
  if(kind==='security') route.innerHTML='<div class="panel"><h2>Security model</h2><p>Verification, audits, publisher records and trust signals are evidence, not proof of safety or endorsement. Review requested permissions and warnings before opening an application.</p></div>';
  else route.innerHTML='<div class="panel"><h2>About 420AppStore</h2><p>420AppStore is a rebuildable, non-canonical catalogue. Registry identity, chain state and Wallet authorization remain independent authority boundaries.</p></div>';
}

async function render(){
  const raw=location.hash.slice(2)||'browse';
  if(raw==='browse') return browse();
  if(raw==='categories') return categories();
  if(raw==='security'||raw==='about') return staticPage(raw);
  if(raw.startsWith('category/')) return category(decodeURIComponent(raw.slice(9)));
  if(raw.startsWith('app/')) return detail(decodeURIComponent(raw.slice(4)));
  if(raw.startsWith('search/')) {const q=decodeURIComponent(raw.slice(7)); searchInput.value=q; return browse(q)}
  return browse();
}

searchForm.addEventListener('submit',e=>{e.preventDefault();const q=searchInput.value.trim();location.hash=q?`#/search/${encodeURIComponent(q)}`:'#/browse'});
window.addEventListener('hashchange',render);
render();
