// L02.9 guarded communication client: no direct Messenger access or local capability minting.
export function mountTripMessaging(root,session,tripProvider,sessionProvider,{origin=globalThis.location?.origin,fetchImpl=globalThis.fetch}={}){
 const section=document.createElement('section');section.className='panel';section.setAttribute('aria-label','Trip communication');
 const title=document.createElement('h2');title.textContent='Trip messages';
 const notice=document.createElement('p');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const list=document.createElement('ul');const message=document.createElement('textarea');message.maxLength=1000;message.setAttribute('aria-label','Message to the assigned trip participant');
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh trip messages';
 const send=document.createElement('button');send.type='button';send.textContent='Send trip message';
 section.append(title,notice,list,message,refresh,send);root.append(section);
 let active=true,busy=false,lastTrip=null,pending=null,validated=false;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 const render=txt=>{notice.textContent=txt;send.disabled=!validated||busy;refresh.disabled=busy;message.disabled=!validated||busy;};
 const allowed=()=>{const trip=tripProvider?.();if(!trip||!id(trip.id)||!['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(trip.state)||
  !session||session.status!=='authenticated'||!['rider','driver'].some(role=>session.roles?.includes(role))||
  !(session.subject===trip.riderId||session.subject===trip.driverId))throw Error('NO_CONFIRMED_MEMBERSHIP');return trip;};
 async function call(trip,method,body){
  if(!origin||typeof fetchImpl!=='function'||typeof sessionProvider?.getAccessToken!=='function')throw Error('MESSAGING_UNAVAILABLE');
  const bearer=await sessionProvider.getAccessToken();
  if(typeof bearer!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))throw Error('AUTH_UNAVAILABLE');
  const url=new URL('/v1/rideshare/trips/'+trip.id+'/messages',origin);if(url.origin!==origin)throw Error('CROSS_ORIGIN');
  const response=await fetchImpl(url,{method,credentials:'omit',cache:'no-store',redirect:'error',headers:{authorization:'Bearer '+bearer,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('MESSAGING_UNAVAILABLE');return response.json();
 }
 async function execute(kind){
  if(!active||busy)return;
  busy=true;validated=false;render('Verifying current trip membership…');
  try{
   const trip=allowed();if(trip.id!==lastTrip){pending=null;list.replaceChildren();lastTrip=trip.id;}
   if(kind==='read'){
    const data=await call(trip,'GET');
    if(!Array.isArray(data?.messages)||data.messages.length>25)throw Error('INVALID_RESPONSE');
    if(!active)return;
    list.replaceChildren();
    for(const row of data.messages){if(!id(row.id)||!id(row.sender)||typeof row.text!=='string'||row.text.length>1000)throw Error('INVALID_RESPONSE');
      const li=document.createElement('li');li.textContent=(row.sender===session.subject?'You':'Trip participant')+': '+row.text;list.append(li);}
   }else{
    const text=message.value.trim();if(!text||text.length>1000)throw Error('INVALID_MESSAGE');
    if(pending&&pending.text!==text)throw Error('RECONCILE_REQUIRED');
    if(!pending){const commandId=globalThis.crypto?.randomUUID?.();if(!id(commandId))throw Error('SECURE_KEY_UNAVAILABLE');pending={text,commandId};}
    await call(trip,'POST',pending);pending=null;message.value='';
   }
   const latest=allowed();if(latest.id!==trip.id||latest.revision!==trip.revision||latest.driverId!==trip.driverId)throw Error('MEMBERSHIP_CHANGED');
   validated=true;render(kind==='send'?'Message accepted by server; delivery is not assumed.':'Messages returned from verified communication service.');
  }catch{validated=false;render('Messaging unavailable or no longer authorized. No message or delivery is assumed.');}
  finally{busy=false;if(active)render(notice.textContent);}
 }
 refresh.addEventListener('click',()=>void execute('read'));
 send.addEventListener('click',()=>void execute('send'));
 render('Trip messaging disabled until a valid active trip and independent Messenger service are available.');
 return Object.freeze({load:()=>execute('read'),destroy(){active=false;pending=null;lastTrip=null;section.remove();}});
}
