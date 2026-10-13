// Private console client: only same-origin, authenticated server endpoints.
// The API must enforce MFA, origin, CSRF, role grants, tenant and canonical authority.
const operations=Object.freeze({propose:'/private/v1/cases/propose',approve:'/private/v1/cases/approve',execute:'/private/v1/cases/execute',reject:'/private/v1/cases/reject',expire:'/private/v1/cases/expire'});
export function validatePrivateAction(action,body){
  if(!Object.hasOwn(operations,action))throw Error('Unsupported case operation');
  if(!body||typeof body!=='object'||!['case_id','event_id'].every(k=>typeof body[k]==='string'&&/^[0-9a-f-]{36}$/i.test(body[k])))throw Error('Invalid case identifiers');
  return operations[action];
}
export async function sendCaseAction({action,body,csrf,send=fetch}){
  const endpoint=validatePrivateAction(action,body);
  if(!csrf||typeof csrf!=='string')throw Error('Authenticated CSRF context required');
  const response=await send(endpoint,{method:'POST',mode:'same-origin',credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body),
    redirect:'error',cache:'no-store'});
  if(!response.ok)throw Error('Case operation denied or unavailable');
  const result=await response.json();
  if(!result||!['PENDING','APPROVED','EXECUTED','REJECTED','EXPIRED'].includes(result.status))throw Error('Invalid case response');
  return result.status;
}
if(typeof document!=='undefined'){
 const form=document.querySelector('#case-form');
 const status=document.querySelector('#case-status');
 form?.addEventListener('submit',async e=>{
  e.preventDefault();
  status.textContent='Requesting server authorization…';
  const data=new FormData(form);
  const action=String(data.get('action')||'');
  const body={case_id:String(data.get('case_id')||''),event_id:String(data.get('event_id')||'')};
  if(action==='propose'){body.purpose=String(data.get('purpose')||'');body.proposal_ref=String(data.get('proposal_ref')||'');body.evidence_ref=String(data.get('evidence_ref')||'');}
  if(action==='approve'||action==='reject'||action==='expire')body.expected_revision=Number(data.get('expected_revision'));
  try{status.textContent=await sendCaseAction({action,body,csrf:document.querySelector('meta[name="csrf-token"]')?.content});}
  catch{status.textContent='Denied or unavailable. No case operation is confirmed.';}
 });
}
