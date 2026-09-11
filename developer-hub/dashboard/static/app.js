const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const badge=(text,kind='')=>`<span class="badge ${kind}">${esc(text)}</span>`;
const card=(title,body)=>`<article class="card"><h3>${esc(title)}</h3>${body}</article>`;
async function api(path){const res=await fetch(path,{cache:'no-store'});let body;try{body=await res.json();}catch{throw new Error(`HTTP ${res.status}`);}if(!res.ok)throw new Error(body.error??`HTTP ${res.status}`);return body;}
const renderDebug=(value)=>{$('debug-output').textContent=JSON.stringify(value,null,2);};
const runDebug=async(fn)=>{try{renderDebug({status:'loading'});renderDebug(await fn());}catch(error){renderDebug({error:error.message});}};
const renderStatus=(value)=>{$('status-output').textContent=JSON.stringify(value,null,2);};
async function load(){return api('/api/dashboard');}
load().then(async data=>{
 $('summary').textContent=`${data.network.name} · ${data.network.environment} · chain ${data.network.chainId}`;
 $('network').innerHTML=`<h2>network</h2><div class="grid">${card('chain',`<p>${badge(data.network.chainId,'ok')} ${esc(data.network.nativeCurrency?.symbol??'')}</p><p>${esc(data.network.rpc.join(', '))}</p>`)}${card('mode',`<p>${badge(data.network.isProduction?'production':'non-production')}</p><p>faucet: ${data.network.canRequestFaucet?'available':'disabled'}</p>`)}</div>`;
 const statusView=await api('/api/status/view');
 $('status-meta').innerHTML=card(statusView.title,`<p>${badge(`chain ${statusView.chainId}`,'ok')} ${esc(statusView.environment)}</p><p>${esc(statusView.supported.join(', '))}</p><p>${esc(statusView.securityRule)}</p>`);
 $('status-run').addEventListener('click',async()=>{try{renderStatus({status:'checking'});renderStatus(await api('/api/status/check'));}catch(error){renderStatus({error:error.message});}});
 $('services').innerHTML=data.services.map(s=>card(s.name,`<p>${badge(s.configured?'configured':'missing',s.configured?'ok':'warn')}</p><p>${s.url?esc(s.url):'not configured'}</p>`)).join('');
 $('contracts').innerHTML=`<div class="row head"><span>name</span><span>protocol</span><span>version</span><span>source</span></div>`+data.contracts.map(c=>`<div class="row"><span>${esc(c.name)}</span><span>${esc(c.protocol)}</span><span>${esc(c.version)}</span><span>${esc(c.source)} ${c.verified?badge('verified','ok'):''}</span></div>`).join('');
 $('guides').innerHTML=data.guides.map(g=>card(g.title,`<p>${esc(g.summary)}</p><p><code>${esc(g.id)}</code></p>`)).join('');
 $('surfaces').innerHTML=Object.entries(data.surfaces).map(([name,s])=>card(name,`<p>${badge(s.phase)}</p><p>${esc(s.authority)}</p><p>${s.canonical===false?'projection only':s.executableHere===false?'handoff only':'read surface'}</p>`)).join('');
 $('security').textContent=data.securityRule;
 const [serviceIdentity,credential]=await Promise.all([api('/api/service-auth/view'),api('/api/service-auth/credential')]);
 $('service-auth').innerHTML=card(serviceIdentity.title,`<p>${badge(serviceIdentity.applicationId,'ok')}</p><p>chain ${esc(serviceIdentity.chainId)} · ${esc(serviceIdentity.environment)}</p><p>audiences: ${esc(serviceIdentity.audiences.join(', '))}</p><p>${esc(serviceIdentity.securityRule)}</p>`)+card(credential.title,`<p>${badge(credential.status,credential.status==='ACTIVE'?'ok':'warn')} ${esc(credential.credentialId)}</p><p>audience: ${esc(credential.audience)}</p><p>scopes: ${esc(credential.scopes.join(', '))}</p><p>revision ${esc(credential.revision)} · expires ${esc(credential.expiresAt)}</p><p>secret digest recorded: ${credential.secretDigestPresent?'yes':'no'} · bearer secret exposed: no</p>`);
 const debugView=await api('/api/debug/view');
 $('debug-meta').innerHTML=card(debugView.title,`<p>${badge(`chain ${debugView.chainId}`,'ok')}</p><p>${esc(debugView.supported.join(', '))}</p><p>${esc(debugView.securityRule)}</p>`);
 $('debug-tx-run').addEventListener('click',()=>runDebug(()=>api(`/api/debug/transaction?hash=${encodeURIComponent($('debug-tx').value.trim())}`)));
 $('debug-logs-run').addEventListener('click',()=>runDebug(()=>{const q=new URLSearchParams();const address=$('debug-address').value.trim();if(address)q.set('address',address);q.set('limit',$('debug-log-limit').value);return api(`/api/debug/logs?${q}`);}));
 $('debug-events-run').addEventListener('click',()=>runDebug(()=>{const q=new URLSearchParams();const protocol=$('debug-protocol').value.trim();const objectKey=$('debug-object').value.trim();if(protocol)q.set('protocol',protocol);if(objectKey)q.set('objectKey',objectKey);q.set('limit',$('debug-event-limit').value);return api(`/api/debug/events?${q}`);}));
 $('debug-diagnostics-run').addEventListener('click',()=>runDebug(()=>api('/api/debug/diagnostics')));
}).catch(error=>{$('summary').textContent=`dashboard failed: ${error.message}`;document.body.dataset.failed='true';});
