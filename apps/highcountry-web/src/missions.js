// Registered-only mission viewer; guest state never becomes trusted evidence.
export function mountMissions({document,main,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,t='')=>{const x=document.createElement(tag);x.textContent=t;return x;};
 const status=el('p',runtime.mode==='connected'?'Loading verified missions…':'Missions require registered gameplay. Guest missions do not award shared rewards.');
 status.setAttribute('role','status');main.append(status);
 if(runtime.mode!=='connected'||typeof authenticate!=='function')return;
 const pane=el('section');main.append(pane);
 const post=async(path,body)=>{
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))throw Error('registration required');
  const r=await fetchImpl(new URL(path,runtime.apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await r.json();if(!r.ok||result?.ok!==true)throw Error('mission request denied');
  return result.result;
 };
 const operation=()=>globalThis.crypto?.randomUUID?.().replaceAll('-','')||'';
 let busy=false;
 const execute=async(fn)=>{if(busy)return;busy=true;try{await fn();await refresh();status.textContent='Mission state synchronized.';}
  catch(e){status.textContent='Mission unavailable: '+e.message;}finally{busy=false;}};
 const button=(parent,label,fn)=>{const b=el('button',label);b.type='button';b.addEventListener('click',()=>execute(fn));parent.append(b);};
 async function refresh(){
  const s=await post('/missions/snapshot',{});
  if(!Array.isArray(s?.missions))throw Error('invalid mission response');
  pane.replaceChildren();
  pane.append(el('p','Version '+s.version+' · Rewards are ordinary nontransferable gameplay records.'));
  for(const m of s.missions){
   const a=el('article');a.append(el('h3',m.id),el('p',m.objective+' · '+m.state+' · '+m.progress+'/'+m.target));
   a.append(el('p','Prerequisites: '+(m.prerequisites.join(', ')||'none')+
    ' · reward: '+m.reward.amount+' '+m.reward.type));
   if(m.deadline!==null)a.append(el('p','Deadline: '+new Date(m.deadline).toLocaleString()));
   if(m.state==='available')button(a,'Activate mission',()=>post('/missions/activate',{id:m.id,operation:operation()}));
   if(m.state==='active'){
    const field=el('label','Signed gameplay evidence ');
    const input=el('input');input.type='text';input.maxLength=8192;field.append(input);a.append(field);
    const countLabel=el('label','Verified units ');
    const count=el('input');count.type='number';count.min='1';count.step='1';count.max=String(m.target-m.progress);
    countLabel.append(count);a.append(countLabel);
    button(a,'Submit progress',async()=>{
     const amount=Number(count.value);
     if(!Number.isSafeInteger(amount)||amount<1||amount>m.target-m.progress||!input.value)throw Error('invalid signed evidence');
     await post('/missions/progress',{id:m.id,operation:operation(),evidence:input.value,amount});
    });
    button(a,'Cancel mission',()=>post('/missions/cancel',{id:m.id,operation:operation()}));
   }
   if(m.state==='complete')button(a,'Claim reward',()=>post('/missions/claim',{id:m.id,operation:operation()}));
   if(m.state==='expired')button(a,'Finalize expiry',()=>post('/missions/expire',{id:m.id,operation:operation()}));
   pane.append(a);
  }
 }
 button(main,'Refresh missions',async()=>{});
 refresh().then(()=>{status.textContent='Authenticated missions loaded.';})
  .catch(e=>{status.textContent='Missions unavailable: '+e.message;});
}
