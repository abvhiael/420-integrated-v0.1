// HC-NEXT-5.3: authenticated journey view; no client-side fragment awards.
export function mountDiscovery({document,main,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,value='')=>{const n=document.createElement(tag);n.textContent=value;return n;};
 const status=el('p',runtime.mode==='connected'?'Loading your heritage discoveries…':
  'Explore the public collection offline; authenticated discoveries require the registered game service.');
 status.setAttribute('role','status');main.append(status);
 if(runtime.mode!=='connected'||typeof authenticate!=='function')return;
 const pane=el('section');main.append(pane);
 let busy=false;
 async function post(path,body){
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))throw Error('registered account required');
  const r=await fetchImpl(new URL(path,runtime.apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
  const answer=await r.json();if(!r.ok||answer?.ok!==true)throw Error('verified discovery unavailable');
  return answer.result;
 }
 async function refresh(){
  const data=await post('/discovery/snapshot',{});
  if(!Array.isArray(data?.founders)||data.founders.length!==16)throw Error('invalid discovery catalogue');
  pane.replaceChildren();
  pane.append(el('p','Original Sixteen journeys · '+(data.master?'Keeper of the Original Sixteen earned':'64 free permanent fragments available')));
  for(const founder of data.founders){
   const card=el('article');card.append(el('h3',founder.founderName+' · '+founder.region));
   for(const fragment of founder.fragments){
    const line=el('section');
    line.append(el('h4',fragment.title+(fragment.earned?' — discovered':'')));
    line.append(el('p','Explore '+fragment.primary.site+' ('+fragment.primary.type+')'));
    line.append(el('p','Accessible alternative: '+fragment.accessible.site+' (public archive research)'));
    if(!fragment.earned){
     const label=el('label','Issuer-signed activity receipt ');
     const input=el('input');input.type='text';input.maxLength=8192;label.append(input);line.append(label);
     for(const option of [fragment.primary,fragment.accessible]){
      const button=el('button',option===fragment.primary?'Submit activity':'Submit accessible research');
      button.type='button';
      button.addEventListener('click',async()=>{
       if(busy)return;busy=true;
       try{
        if(!input.value)throw Error('signed activity receipt required');
        const op=globalThis.crypto?.randomUUID?.().replaceAll('-','');
        if(!op)throw Error('secure operation identifier unavailable');
        await post('/discovery/ingest',{operation:op,objectiveId:option.objectiveId,evidence:input.value});
        await refresh();status.textContent='Verified discovery recorded.';
       }catch(e){status.textContent='Discovery denied: '+e.message;}finally{busy=false;}
      });line.append(button);
     }
    }
    card.append(line);
   }
   if(founder.revealed)card.append(el('p','Revelation unlocked: '+founder.revelation));
   pane.append(card);
  }
 }
 refresh().then(()=>{status.textContent='Verified heritage journeys loaded.';})
  .catch(e=>{status.textContent='Heritage discoveries unavailable: '+e.message;});
}
