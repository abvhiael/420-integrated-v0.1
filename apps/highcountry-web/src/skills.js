// HC-NEXT-5.1: server-authoritative progression viewer; no local guest unlock or wallet prompt.
export function mountSkills({document,main,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;};
 const status=el('p',runtime.mode==='connected'?'Checking registered skills and research…':
  'Skills and research require a verified registered profile. Local guest gameplay remains available.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.append(status);
 if(runtime.mode!=='connected'||typeof authenticate!=='function')return;
 const pane=el('section');main.append(pane);
 let busy=false;
 const post=async(path,input)=>{
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))throw Error('registered-session-required');
  const res=await fetchImpl(new URL(path,runtime.apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(input)});
  if(!res.ok)throw Error('progression-request-denied');
  const body=await res.json();if(body?.ok!==true||!Object.hasOwn(body,'result'))throw Error('progression-invalid-response');
  return body.result;
 };
 const button=(parent,text,action)=>{
  const b=el('button',text);b.type='button';b.addEventListener('click',action);parent.append(b);
 };
 const operate=async(action,message)=>{
  if(busy)return;busy=true;
  try{await action();status.textContent=message;await refresh();}
  catch(e){status.textContent='Progression unavailable or denied: '+e.message;}
  finally{busy=false;}
 };
 const op=()=>globalThis.crypto?.randomUUID?.().replaceAll('-','')||'';
 async function refresh(){
  const snapshot=await post('/progression/snapshot',{});
  if(!snapshot||!Array.isArray(snapshot.records))throw Error('progression-invalid-response');
  pane.replaceChildren();
  pane.append(el('p','Progression catalogue '+snapshot.version+' · available BUDS '+snapshot.availableBuds));
  for(const record of snapshot.records){
   const card=el('article');card.append(el('h3',record.id+' · '+record.kind));
   card.append(el('p','Evidence '+record.points+'/'+record.requiredPoints+
    ' · cost '+record.cost+' BUDS · level '+record.minLevel+
    ' · '+(record.unlocked?'Unlocked':'Locked')));
   card.append(el('p','Prerequisites: '+(record.prerequisites.join(', ')||'none')));
   card.append(el('p','Approved convenience: '+record.effect+' ('+record.effectValue+'/'+record.cap+
    '). No canonical assets or protected scoring benefit.'));
   if(!record.unlocked&&record.points<record.requiredPoints){
    const label=el('label','Approved signed progression evidence (base64url) ');
    const proof=document.createElement('input');proof.type='text';proof.maxLength=8192;
    label.append(proof);card.append(label);
    const pointsLabel=el('label','Verified evidence points ');
    const pointsInput=document.createElement('input');pointsInput.type='number';
    pointsInput.min='1';pointsInput.max=String(record.requiredPoints-record.points);
    pointsInput.step='1';pointsLabel.append(pointsInput);card.append(pointsLabel);
    button(card,'Submit verified progress',()=>operate(async()=>{
     const points=Number(pointsInput.value);
     if(!Number.isSafeInteger(points)||points<1||points>record.requiredPoints-record.points
       ||typeof proof.value!=='string'||!proof.value||proof.value.length>8192)
      throw Error('invalid progression evidence');
     await post('/progression/evidence',{operation:op(),trackId:record.id,
      evidence:proof.value,points});
    },'Independent progression evidence accepted.'));
   }
   if(!record.unlocked&&record.points===record.requiredPoints){
    button(card,'Unlock for '+record.cost+' BUDS',()=>operate(async()=>{
     if(globalThis.confirm?.('Spend '+record.cost+' BUDS on '+record.id+'?')!==true)return;
     await post('/progression/unlock',{operation:op(),trackId:record.id});
    },'Unlock request processed by the authoritative service.'));
   }
   pane.append(card);
  }
 }
 button(main,'Refresh skills and research',()=>operate(async()=>{},'Refreshing verified progression…'));
 refresh().then(()=>{status.textContent='Authenticated progression loaded. No wallet required.';})
  .catch(e=>{status.textContent='Progression unavailable: '+e.message;});
}
