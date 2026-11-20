import {create420IDPasskey,authenticate420IDPasskey} from './browser.mjs';
const get=id=>document.getElementById(id);
let emailChallenge=null,registration=null,recovery=null,current=null,busy=false;
const status=message=>{get('status').textContent=message;};
function state(){
 for(const b of document.querySelectorAll('button')){
  b.disabled=busy||(b.id==='register'&&!registration)||(b.id==='replace'&&!recovery)
   ||((['renew','list','logout','logout-all'].includes(b.id)||b.dataset.revoke==='true')&&!current)
   ||(b.id==='login'&&!!current)||(b.closest('#email-start')!==null&&!!current);
 }
 get('signed-in').textContent=current?'Signed in · idle expiry '+new Date(current.idleUntil).toLocaleString()+' · absolute expiry '+new Date(current.expiresAt).toLocaleString():'Signed out';
}
async function post(path,body){
 const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw new Error(response.status===429?'Too many requests. Try again later.':response.status===409?'Sign out before signing in or recovering.':'Request could not be completed. Refresh status or restart verification.');
 return response.json();
}
function receipt(label,id){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw new Error('Missing acceptance receipt.');
 const li=document.createElement('li');li.textContent=label+': '+id;get('receipts').append(li);
}
function clearCeremonies(){emailChallenge=null;registration=null;recovery=null;get('secret').value='';get('email-finish').hidden=true;}
async function refresh(){const r=await post('/v1/session/status',{});current=r.authenticated?r.session:null;get('sessions').replaceChildren();}
async function run(action){
 if(busy)return;busy=true;state();
 try{await action()}catch(error){status(error instanceof Error?error.message:'Request could not be completed.');try{await refresh()}catch{}}
 finally{busy=false;state()}
}
get('email-start').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
 clearCeremonies();const r=await post('/v1/email/start',{email:get('email').value});
 emailChallenge=r.challengeId;get('email-finish').hidden=false;status('Enter the code from your approved email address within ten minutes.');get('secret').focus();
})});
get('email-finish').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
 const secret=get('secret').value;get('secret').value='';
 const r=await post('/v1/email/finish',{challengeId:emailChallenge,secret,recover:get('recover').checked});
 clearCeremonies();receipt('Email verified',r.receipt);registration=r.registration??null;recovery=r.recovery??null;current=r.session??null;
 status(recovery?'Mailbox verified. Confirm replacement with a different passkey. Existing credentials remain valid until successful replacement.':'Signed in. You may create an initial passkey if offered.');
})});
get('register').addEventListener('click',()=>void run(async()=>{
 const options=registration;registration=null;
 const r=await post('/v1/passkey/register',await create420IDPasskey(options));receipt('Passkey registered',r.receipt);status('Passkey registered. Sign out and test it separately.');
}));
get('replace').addEventListener('click',()=>void run(async()=>{
 const options=recovery;recovery=null;
 const r=await post('/v1/recovery/finish',await create420IDPasskey(options));
 if(!r.recovered)throw new Error('Replacement failed.');
 current=null;status('Passkey replaced and prior sessions revoked. Sign in using your new passkey.');
}));
get('login').addEventListener('click',()=>void run(async()=>{
 const opt=await post('/v1/passkey/start',{});const r=await post('/v1/passkey/finish',await authenticate420IDPasskey(opt));
 receipt('Passkey verified',r.receipt);current=r.session;clearCeremonies();status('Signed in with passkey.');
}));
get('renew').addEventListener('click',()=>void run(async()=>{current=(await post('/v1/session/renew',{})).session;status('Session renewed.');}));
get('list').addEventListener('click',()=>void run(async()=>{
 const r=await post('/v1/session/list',{});const list=get('sessions');list.replaceChildren();
 for(const session of r.sessions){
  const li=document.createElement('li');li.textContent=session.method+' · '+new Date(session.issuedAt).toLocaleString()+(session.id===current.id?' (current) ':' ');
  const b=document.createElement('button');b.type='button';b.dataset.revoke='true';b.textContent='Revoke';
  b.addEventListener('click',()=>void run(async()=>{await post('/v1/session/revoke',{sessionId:session.id});await refresh();status('Session revoked.');}));li.append(b);list.append(li);
 }
}));
for(const [button,path] of [['logout','/v1/session/logout'],['logout-all','/v1/session/revoke-all']]){
 get(button).addEventListener('click',()=>void run(async()=>{await post(path,{});current=null;clearCeremonies();get('sessions').replaceChildren();status('Signed out.');}));
}
void run(refresh);
