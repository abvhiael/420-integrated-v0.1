import {OPERATIONS,SocialEconomyError} from './social-economy-controller.js';
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
const field=(label,type='text')=>{const w=el('label','hc-social-field');w.append(el('span','',label));const i=el('input');i.type=type;i.required=true;w.append(i);return {element:w,input:i};};
function section(title,parent){const s=el('section','hc-social-section');s.append(el('h3','',title));parent.append(s);return s;}
function actionForm(parent,controller,{label,action,fields=[],refresh}) {
 const form=el('form','hc-social-form'),inputs={};form.append(el('h4','',label));
 for(const name of fields){const f=field(name);inputs[name]=f.input;form.append(f.element);}
 const b=el('button','',label);b.type='submit';
 if(!ENABLED_ACTIONS.has(action)){b.disabled=true;b.title='Operation pending canonical on-chain authorization qualification';form.setAttribute('aria-disabled','true');}
 form.append(b);parent.append(form);
 form.addEventListener('submit',async event=>{
  event.preventDefault();b.disabled=true;
  try{const payload=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()]));await controller.act(action,payload);form.reset();await refresh();}
  catch(e){parent.dispatchEvent(new CustomEvent('hc-social-error',{bubbles:true,detail:e.message}));}
  finally{b.disabled=false;}
 });
}
// Keep unsupported methods visible as unavailable, never as actionable promises.
const ENABLED_ACTIONS=new Set(Object.values(OPERATIONS));
const forms={
 createOrganization:['id','metadataHash'],invite:['organization','account'],revokeInvitation:['organization','account'],join:['organization'],
 leave:['organization'],remove:['organization','account'],proposeLeader:['organization','candidate'],acceptLeader:['organization'],
 delegate:['organization','delegate','action','scope','starts','expires','maxUses'],revokeGrant:['grantId'],
 createCooperative:['id','organization'],enroll:['cooperative'],withdraw:['cooperative'],
 propose:['cooperative','action','scope','value'],vote:['proposal','support'],cancelProposal:['proposal'],execute:['proposal']
};
/**
 * Mounts a real DOM interface. Every control submits to a configured server/chain gateway.
 * Read-only views and histories are never considered signatures or transaction proof.
 */
export function mountSocialEconomy(root,controller){
 if(!root||typeof root.replaceChildren!=='function'||!controller)throw new SocialEconomyError('root and controller required');
 const shell=el('main','hc-social-economy'),status=el('p','hc-social-status','Connect a registered player session to access organizations.');
 shell.append(el('h2','','High Country · Social Economy'),status);
 const displays=section('My organizations & cooperative memberships',shell),permissions=section('Authorized roles & shared resources',shell),actions=section('Organization & cooperative operations',shell),history=section('Transaction and governance history',shell);
 const error=el('p','hc-social-error');error.setAttribute('role','alert');shell.append(error);
 shell.addEventListener('hc-social-error',e=>{error.textContent=e.detail;});
 const refresh=async()=>{
  const data=await controller.snapshot();status.textContent='Authenticated player: '+data.principal;
  displays.replaceChildren(el('h3','','My organizations & cooperative memberships'));
  for(const [title,items] of [['Organizations',data.organizations],['Cooperatives',data.cooperatives]]){
   displays.append(el('h4','',title));
   const list=el('ul');for(const item of items)list.append(el('li','',item.name??item.id??'Unnamed'));
   displays.append(list);
  }
  permissions.replaceChildren(el('h3','','Authorized roles & shared resources'));
  const list=el('ul');for(const p of data.permissions)list.append(el('li','',`${p.action??'permission'} · ${p.scope??'unspecified'} · ${p.status??'unknown'}`));
  permissions.append(list);
 };
 for(const [key,action] of Object.entries(OPERATIONS))actionForm(actions,controller,{label:key,action,fields:forms[key],refresh});
 const picker=el('form'),kind=el('select'),id=field('Organization, cooperative or transaction ID');
 for(const v of ['organization','cooperative','proposal','permission','treasury','history']){const o=el('option','',v);o.value=v;kind.append(o);}
 const find=el('button','','Load history');find.type='submit';picker.append(kind,id.element,find);history.append(picker);
 picker.addEventListener('submit',async ev=>{
  ev.preventDefault();find.disabled=true;
  try{const result=await controller.history(kind.value,id.input.value.trim());history.querySelectorAll('.hc-social-history').forEach(n=>n.remove());
   const list=el('ol','hc-social-history');
   for(const entry of result.entries)list.append(el('li','',`${entry.state} · ${entry.id} ${entry.settled===false?'(authorization only; no verified transfer)':''}`));
   history.append(list);
  }catch(e){error.textContent=e.message;}finally{find.disabled=false;}
 });
 root.replaceChildren(shell);
 return Object.freeze({refresh,root:shell});
}
