// Restricted AUTH-4 browser adapter; session credentials stay HttpOnly.
export function installProfileUI({get,post,run,status,isAuthenticated}){
 let profile=null;
 const fields=['profile-username','profile-display-name','profile-bio','profile-avatar','profile-public'];
 function reset(){
  profile=null;
  for(const id of fields){const el=get(id);if(id==='profile-public')el.checked=false;else el.value='';}
  get('profile-version').textContent='No saved profile';
  get('profile-lookup-result').textContent='';
 }
 function visibility(){
  get('profile-section').hidden=!isAuthenticated();
 }
 function display(p){
  profile=p;
  get('profile-username').value=p.username??'';
  get('profile-display-name').value=p.displayName??'';
  get('profile-bio').value=p.bio??'';
  get('profile-avatar').value=p.avatarRef??'';
  get('profile-public').checked=p.visibility==='public';
  get('profile-version').textContent='Profile revision '+p.revision;
 }
 async function load(){const result=await post('/v1/profile/me',{});display(result.profile);status('Profile loaded.');}
 get('profile-load').addEventListener('click',()=>void run(load));
 get('profile-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
  // A save must never guess the revision of an unobserved profile.
  if(!profile){await load();}
  const body={
   username:get('profile-username').value,
   displayName:get('profile-display-name').value,
   bio:get('profile-bio').value,
   avatarRef:get('profile-avatar').value,
   visibility:get('profile-public').checked?'public':'private',
   expectedRevision:profile.revision
  };
  try{
   const result=await post('/v1/profile/update',body);
   display(result.profile);status('Profile saved.');
  }catch(e){await load();throw e}
 })});
 get('profile-lookup-form').addEventListener('submit',event=>{event.preventDefault();void run(async()=>{
  get('profile-lookup-result').textContent='';
  const result=await post('/v1/profile/lookup',{username:get('profile-lookup-name').value});
  const p=result.profile;
  // textContent, never HTML: profile data is untrusted user-supplied text.
  get('profile-lookup-result').textContent='@'+p.username+' · '+p.displayName+(p.bio?' · '+p.bio:'');
 })});
 reset();visibility();
 return {clear(){reset();visibility();},visibility};
}
