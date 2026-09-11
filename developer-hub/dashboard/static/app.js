const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=(text,kind='')=>`<span class="badge ${kind}">${esc(text)}</span>`;
const card=(title,body)=>`<article class="card"><h3>${esc(title)}</h3>${body}</article>`;

async function load(){
  const res=await fetch('/api/dashboard',{cache:'no-store'}); if(!res.ok) throw new Error(`HTTP ${res.status}`); return res.json();
}

load().then(data=>{
  $('summary').textContent=`${data.network.name} · ${data.network.environment} · chain ${data.network.chainId}`;
  $('network').innerHTML=`<h2>network</h2><div class="grid">${card('chain',`<p>${badge(data.network.chainId,'ok')} ${esc(data.network.nativeCurrency?.symbol??'')}</p><p>${esc(data.network.rpc.join(', '))}</p>`)}${card('mode',`<p>${badge(data.network.isProduction?'production':'non-production')}</p><p>faucet: ${data.network.canRequestFaucet?'available':'disabled'}</p>`)}</div>`;
  $('services').innerHTML=data.services.map(s=>card(s.name,`<p>${badge(s.configured?'configured':'missing',s.configured?'ok':'warn')}</p><p>${s.url?esc(s.url):'not configured'}</p>`)).join('');
  $('contracts').innerHTML=`<div class="row head"><span>name</span><span>protocol</span><span>version</span><span>source</span></div>`+data.contracts.map(c=>`<div class="row"><span>${esc(c.name)}</span><span>${esc(c.protocol)}</span><span>${esc(c.version)}</span><span>${esc(c.source)} ${c.verified?badge('verified','ok'):''}</span></div>`).join('');
  $('guides').innerHTML=data.guides.map(g=>card(g.title,`<p>${esc(g.summary)}</p><p><code>${esc(g.id)}</code></p>`)).join('');
  $('surfaces').innerHTML=Object.entries(data.surfaces).map(([name,s])=>card(name,`<p>${badge(s.phase)}</p><p>${esc(s.authority)}</p><p>${s.canonical===false?'projection only':s.executableHere===false?'handoff only':'read surface'}</p>`)).join('');
  $('security').textContent=data.securityRule;
}).catch(error=>{ $('summary').textContent=`dashboard failed: ${error.message}`; document.body.dataset.failed='true'; });
