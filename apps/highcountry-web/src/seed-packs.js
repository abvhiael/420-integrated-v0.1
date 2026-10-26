export function createSeedPackClient({apiUrl,authenticate,fetchImpl=fetch}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl))throw Error('seed-service-config-invalid');
 async function post(path,body){const token=await authenticate?.();if(typeof token!=='string'||!token||/\s/.test(token))throw Error('seed-sign-in-required');
  const response=await fetchImpl(new URL('/seeds/packs/'+path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
  if(!response.ok)throw Error('seed-pack-request-denied');const data=await response.json();if(data?.ok!==true||!data.result)throw Error('seed-pack-response-invalid');return data.result;
 }
 return {open:packId=>post('open',{packId}),opening:packId=>post('opening',{packId}),inventory:()=>post('inventory',{}),starter:region=>post('starter',{region}),prepare:packId=>post('prepare',{packId}),confirm:packId=>post('confirm',{packId})};
}
export function mountSeedPacks({document,parent,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const section=el('section');section.className='seed-collection seed-packs';section.append(el('h3','My seed packs'),el('p','Start with two free common packs: two distinct cultivars, three seeds each. Your regional choice is permanent. Standard pack sales are not open yet. Standard openings use verified 60% common, 30% rare and 10% Original Sixteen odds. Committing an opening is permanent.'));parent.append(section);
 const status=el('p',runtime.mode==='connected'?'Sign in to view your packs and claim your starter seeds.':'Starter seeds require the authenticated game service.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(status);
 if(runtime.mode!=='connected')return {section};
 const client=createSeedPackClient({apiUrl:runtime.apiUrl,authenticate,fetchImpl}),label=el('label','Starter region '),region=el('select');region.setAttribute('aria-label','Starter region');for(const name of ['Emerald Coast','Golden Prairie','Red Mesa']){const option=el('option',name);option.value=name;region.append(option);}label.append(region);section.append(label);
 const inventory=el('div');let busy=false;
 const button=(parent,text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);parent.append(b);return b;};
 const run=async fn=>{if(busy)return;busy=true;try{await fn();}catch{status.textContent='Packs unavailable. Sign in, check your wallet link and try again. Your existing grants are preserved.';}finally{busy=false;}};
 const claim=button(section,'Claim starter packs',()=>run(async()=>{await client.starter(region.value);await refresh();}));
 button(section,'Refresh seed packs',()=>run(refresh));section.append(inventory);
 async function refresh(){
  const data=await client.inventory();if(!Array.isArray(data.packs)||!Array.isArray(data.lots))throw Error('invalid pack inventory');
  claim.disabled=data.starterClaimed===true;region.disabled=data.starterClaimed===true;inventory.replaceChildren();
  status.textContent=data.starterClaimed?'Starter packs claimed. Each pack can be issued once.':'Choose a region to claim your two starter packs.';
  for(const pack of data.packs){const card=el('article');card.className='seed-earned';const art=el('img');art.className='seed-pack-art';art.src='/assets/highcountry/seed-packs/hc-seed-pack-'+pack.region.toLowerCase().replaceAll(' ','-')+'.png';art.alt=pack.region+' seed pack';art.loading='lazy';card.append(art);card.append(el('h4',pack.region+' · '+(pack.starterCultivarId?'Common starter pack':'Seed pack')),el('p',pack.seeds+' seeds · '+(pack.status==='opened'?'Issued':pack.status==='issuance-prepared'?'Preparing seeds':pack.status==='opening-committed'?'Waiting for verified opening':pack.status==='outcome-ready'?'Verified selection ready':'Sealed')));
   if(!pack.starterCultivarId&&pack.status==='sealed')button(card,'Commit pack opening',()=>run(async()=>{await client.open(pack.id);await refresh();}));
   if(pack.status==='opening-committed')button(card,'Check verified opening',()=>run(async()=>{await client.opening(pack.id);await refresh();}));
   if(pack.outcome?.verification){const v=pack.outcome.verification,proof=el('details');proof.append(el('summary','Opening verification'));for(const [label,value] of [['Opening contract',v.contract],['Canonical request',v.requestId],['Entropy root',v.entropy],['Proof commitment',v.proofHash],['Finalized block',v.anchor?.blockHash]])if(value)proof.append(el('p',label+': '+value));card.append(proof);}
   if(pack.status==='outcome-ready'){card.append(el('p',pack.outcome.cultivarName+' · '+pack.outcome.tier));button(card,'Prepare selected seeds',()=>run(async()=>{await client.prepare(pack.id);await refresh();}));}
   if(pack.starterCultivarId&&pack.status==='sealed')button(card,'Prepare starter seeds',()=>run(async()=>{await client.prepare(pack.id);await refresh();}));
   if(pack.status==='issuance-prepared')button(card,'Check seed issuance',()=>run(async()=>{await client.confirm(pack.id);await refresh();}));
   inventory.append(card);
  }
 }
 return {section,refresh};
}
