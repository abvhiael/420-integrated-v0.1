// L02.6: private status and remediation interface. Never uploads document bytes or stores secrets in browser.
export function mountDriverOnboarding(container,session,adapter){
 let active=true;
 const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Driver onboarding');
 const title=document.createElement('h2');title.textContent='Driver and vehicle eligibility';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 panel.append(title,status);container.append(panel);
 if(!session||session.status!=='authenticated'||!session.roles?.includes('driver')||typeof session.subject!=='string'||!adapter){
  status.textContent='Onboarding is unavailable until your verified driver session is connected.';
  return()=>{active=false;panel.remove();};
 }
 const field=(name,label)=>{const wrap=document.createElement('label');wrap.textContent=label;
 const input=document.createElement('input');input.name=name;input.required=true;input.maxLength=128;
 wrap.append(input);panel.append(wrap);return input;};
 const vehicle=field('vehicle','Vehicle reference');
 const documentKind=document.createElement('select');documentKind.setAttribute('aria-label','Document type');
 for(const kind of ['licence','insurance','registration','inspection','background_check']){
 const o=document.createElement('option');o.value=kind;o.textContent=kind;documentKind.append(o);}
 panel.append(documentKind);
 const privateRef=field('privateRef','Private upload receipt reference (never document content)');
 const expiry=field('expiry','Document expiry (Unix seconds)');
 const submit=document.createElement('button');submit.type='button';submit.textContent='Submit for independent review';
 const reload=document.createElement('button');reload.type='button';reload.textContent='Refresh eligibility status';panel.append(submit,reload);
 let revision=null,busy=false;
 async function refresh(){if(busy)return;busy=true;submit.disabled=true;status.textContent='Retrieving private review status…';
 try{const x=await adapter.read(session.subject);if(!active)return;
 if(!Number.isSafeInteger(x.revision)||x.revision<0)throw Error('Invalid response');
 revision=x.revision;status.textContent='Eligibility status: '+x.status+'. Remediation: '+(Array.isArray(x.remediation)?x.remediation.join(', '):'not supplied')+'. Submissions do not grant driving authorization.';
 }catch{if(active){revision=null;status.textContent='Review status unavailable. No eligibility is assumed.';}}
 finally{busy=false;if(active)submit.disabled=revision===null;}
 }
 submit.addEventListener('click',async()=>{if(busy||revision===null)return;busy=true;submit.disabled=true;
 status.textContent='Submitting private receipt metadata for review…';
 try{
 const exp=Number(expiry.value);if(!Number.isSafeInteger(exp)||exp<=0)throw Error('Invalid expiry');
 await adapter.submit(session.subject,{driverId:session.subject,vehicleId:vehicle.value,documents:[{kind:documentKind.value,privateRef:privateRef.value,expiresAt:exp}],expectedRevision:revision,commandId:globalThis.crypto.randomUUID()});
 status.textContent='Submission received; independent review required.';revision=null;
 }catch{if(active)status.textContent='Submission not confirmed. Refresh status before retrying; do not assume approval.';}
 finally{busy=false;if(active)submit.disabled=revision===null;}
 });
 reload.addEventListener('click',()=>void refresh());void refresh();
 return()=>{active=false;panel.remove();};
}
