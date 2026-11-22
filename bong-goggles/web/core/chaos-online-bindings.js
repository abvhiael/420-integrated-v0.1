// Account-only multiplayer browser event wiring; no game authority or secrets.
export function bindChaosOnline(root,chaosOnline,pathname){
 if(pathname!=='/classics/cross-country-chaos'||!chaosOnline)return;
 root.querySelector('[data-chaos-online-create]')?.addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget);
  const humanSeats=Number(form.get('humanSeats')),botCount=Number(form.get('botCount'));
  void chaosOnline.mutate('create',{humanSeats,bots:Array.from({length:botCount},()=>String(form.get('difficulty'))),vehicle:'wagon'}).catch(()=>{});
 });
 root.querySelector('[data-chaos-online-join]')?.addEventListener('submit',event=>{
  event.preventDefault();void chaosOnline.mutate('join',{code:String(new FormData(event.currentTarget).get('code')||'').trim()}).catch(()=>{});
 });
 root.querySelector('[data-chaos-online-chat]')?.addEventListener('submit',event=>{
  event.preventDefault();const input=event.currentTarget.elements.namedItem('text');
  const text=input?.value?.trim();if(!text)return;
  input.value='';void chaosOnline.sendChat(text).catch(()=>{
   const current=root.querySelector('[data-chaos-online-chat] textarea');
   if(current&&!current.value)current.value=text;
  });
 });
 for(const b of root.querySelectorAll('[data-chaos-online-select]'))b.addEventListener('click',()=>chaosOnline.selectCard(Number(b.dataset.chaosOnlineSelect)));
 for(const b of root.querySelectorAll('[data-chaos-online-action]'))b.addEventListener('click',()=>{
  const action=b.dataset.chaosOnlineAction;
  if(action==='back'){chaosOnline.emit({...chaosOnline.state,room:null,error:null,unreadChat:0,chatError:null});void chaosOnline.refresh();return;}
  if(action==='chat-toggle'){chaosOnline.toggleChat();return;}
  if(action==='mute'){chaosOnline.toggleMute(Number(b.dataset.seat));return;}
  if(action==='chat-report'){void chaosOnline.reportChat(b.dataset.messageId).catch(()=>{});return;}
  if(action==='refresh'){void chaosOnline.refresh();return;}
  if(action==='open'){void chaosOnline.open(b.dataset.room);return;}
  if(action==='move'){try{void chaosOnline.mutate('move',{move:JSON.parse(b.dataset.move)}).catch(()=>{});}catch{}return;}
  if(action==='start'||action==='next')void chaosOnline.mutate(action).catch(()=>{});
 });
}
