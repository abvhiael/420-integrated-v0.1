// HC-NEXT-5.2: wallet-free registered mission lifecycle, never client-side completion.
export function mountMissions({document,main,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const status=el('p',runtime.mode==='connected'?'Loading verified missions…':
  'Missions require a registered player account. Offline guest play remains available.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.append(status);
 if(runtime.mode!=='connected'||typeof authenticate!=='function')return;
 const panel=el('section');main.append(panel);let busy=false;
 async function post(path,payload){
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))throw Error('registered-session-required');
  const response=await fetchImpl(new URL(path,runtime.apiUrl+'/'),{method:'POST',
   cache:'no-store',credentials:'omit',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify(payload)});
  if(!response.ok)throw Error('mission-request-denied');
  const data=await response.json();if(data?.ok!==true)throw Error('mission-invalid-response');
  return data.result;
 }
 const operation=()=>globalThis.crypto?.randomUUID?.().replaceAll('-','')||'';
 function button(parent,label,fn){
  const n=el('button',label);n.type='button';n.addEventListener('click',async()=>{
   if(busy)return;busy=true;
   try{const result=await fn();status.textContent=result===false?'Mission action cancelled.':'Mission action processed by authenticated service.';await refresh();}
   catch(e){status.textContent='Mission operation denied: '+e.message;}
   finally{busy=false;}
  });parent.append(n);
 }
 async function refresh(){
  const snapshot=await post('/missions/snapshot',{});
  if(!snapshot||!Array.isArray(snapshot.missions))throw Error('mission-invalid-response');
  panel.replaceChildren(el('p','Mission catalogue '+snapshot.version));
  for(const m of snapshot.missions){
   const card=el('article');card.append(el('h3',m.id));
   card.append(el('p','Objective: '+m.objective+' · '+m.progress+'/'+m.target+
    ' · '+m.status+' · maximum '+m.maxPerProof+' point per independent proof'));
   card.append(el('p','Deadline: '+(m.deadline===null?'Not started':new Date(m.deadline).toLocaleString())+
    ' · reward metadata '+m.rewardUnits+' · no automatic BUDS issuance'));
   if(m.status==='available'){
    button(card,'Activate mission',()=>post('/missions/activate',{operation:operation(),missionId:m.id}));
   }
   if(m.status==='active'){
    const proof=document.createElement('input');proof.type='text';proof.maxLength=8192;
    proof.setAttribute('aria-label','Signed gameplay evidence for '+m.id);card.append(proof);
    const amount=document.createElement('input');amount.type='number';amount.min='1';
    amount.max=String(m.maxPerProof);amount.step='1';amount.value='1';
    amount.setAttribute('aria-label','Verified points for '+m.id);card.append(amount);
    button(card,'Submit verified progress',()=>{
     const points=Number(amount.value);
     if(!Number.isSafeInteger(points)||points<1||points>m.maxPerProof||
       typeof proof.value!=='string'||!proof.value||proof.value.length>8192)throw Error('invalid signed evidence');
     return post('/missions/progress',{operation:operation(),missionId:m.id,evidence:proof.value,amount:points});
    });
    button(card,'Cancel mission',()=>{
     if(globalThis.confirm?.('Cancel '+m.id+'? This mission cannot be restarted.')!==true)return false;
     return post('/missions/cancel',{operation:operation(),missionId:m.id});
    });
   }
   if(m.status==='complete')button(card,'Claim completed mission',()=>
    post('/missions/claim',{operation:operation(),missionId:m.id}));
   panel.append(card);
  }
 }
 button(main,'Refresh missions',async()=>false);
 refresh().then(()=>{status.textContent='Registered mission records loaded.';})
  .catch(e=>{status.textContent='Missions unavailable: '+e.message;});
}
