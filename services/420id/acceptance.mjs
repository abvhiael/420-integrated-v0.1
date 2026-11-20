import {create420IDPasskey,authenticate420IDPasskey} from './browser.mjs';
const get=id=>document.getElementById(id);
let emailChallenge=null,registration=null,busy=false;
const status=message=>{get('status').textContent=message;};
const state=()=>{for(const button of document.querySelectorAll('button'))button.disabled=busy||(button.id==='register'&&!registration);};
async function post(path,body){
 const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw new Error(response.status===429?'Too many requests. Try again later.':'Verification could not be completed. Check your code or restart the ceremony.');
 return await response.json();
}
function receipt(label,id){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw new Error('Missing acceptance receipt.');
 const li=document.createElement('li');li.textContent=label+': '+id;get('receipts').append(li);
}
async function run(action){
 if(busy)return;busy=true;state();
 try{await action();}catch(error){status(error instanceof Error?error.message:'Verification could not be completed.');}
 finally{busy=false;state();}
}
get('email-start').addEventListener('submit',event=>{
 event.preventDefault();void run(async()=>{
  registration=null;emailChallenge=null;get('email-finish').hidden=true;get('secret').value='';
  const result=await post('/v1/email/start',{email:get('email').value});
  emailChallenge=result.challengeId;get('email-finish').hidden=false;
  status('If this approved mailbox can receive mail, a code will arrive. Enter it here within ten minutes.');
  get('secret').focus();
 });
});
get('email-finish').addEventListener('submit',event=>{
 event.preventDefault();void run(async()=>{
  const secret=get('secret').value;get('secret').value='';
  const result=await post('/v1/email/finish',{challengeId:emailChallenge,secret});
  if(result.verified!==true)throw new Error('Email verification did not complete.');
  emailChallenge=null;get('email-finish').hidden=true;registration=result.registration??null;
  receipt('Email verified',result.receipt);
  status(registration?'Email verified. Create your passkey next.':'Email verified. If you already enrolled a passkey, test it below.');
 });
});
get('register').addEventListener('click',()=>void run(async()=>{
 if(!registration)return;
 const options=registration;registration=null;
 const body=await create420IDPasskey(options);
 const result=await post('/v1/passkey/register',body);
 if(result.registered!==true)throw new Error('Passkey registration did not complete.');
 receipt('Passkey registered',result.receipt);
 status('Passkey registered. Select Verify with passkey to test a fresh signed assertion.');
}));
get('login').addEventListener('click',()=>void run(async()=>{
 const options=await post('/v1/passkey/start',{});
 const body=await authenticate420IDPasskey(options);
 const result=await post('/v1/passkey/finish',body);
 if(result.verified!==true)throw new Error('Passkey verification did not complete.');
 receipt('Passkey verified',result.receipt);
 status('Passkey authentication verified. No application session or wallet permission was issued.');
}));
state();
