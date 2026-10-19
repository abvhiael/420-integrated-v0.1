// Handles login, rotating refresh tokens, explicit reauthentication, and revocation.
// Never presents a mobile role until a fresh server authority decision succeeds.
export function createMobileLifecycle({identity,session,store,clock=()=>Math.floor(Date.now()/1000)}){
 if(!identity||!session||!store||typeof store.read!=='function'||typeof store.write!=='function'||typeof store.clear!=='function')throw Error('INVALID_CONFIGURATION');
 let revision=0;
 const clear=async()=>{revision++;await session.logout();await store.clear();};
 async function persist(token,accountId,deviceId){
  if(!token||!token.accessToken||!token.refreshToken||!Number.isSafeInteger(token.expiresAt))throw Error('INVALID_CREDENTIAL');
  const value={...token,accountId,deviceId};
  await store.write(value);
  await session.begin({accessToken:token.accessToken,accountId,deviceId});
  return value;
 }
 async function authorized(role,credentials){
  const op=++revision;
  let value=credentials||await store.read();
  if(!value)throw Error('REAUTHENTICATION_REQUIRED');
  try{
   if(value.expiresAt<=clock()+30){
    const refreshed=await identity.refresh(value);
    if(op!==revision)throw Error('STALE_OPERATION');
    value=await persist(refreshed,value.accountId,value.deviceId);
   }else await session.begin({accessToken:value.accessToken,accountId:value.accountId,deviceId:value.deviceId});
   const verified=await session.revalidate(role);
   if(op!==revision)throw Error('STALE_OPERATION');
   return verified;
  }catch(e){if(op===revision)await clear();throw e;}
 }
 return Object.freeze({
  async signIn({role,accountId,deviceId}){
   const op=++revision;
   const token=await identity.signIn();
   if(op!==revision)throw Error('STALE_OPERATION');
   const value=await persist(token,accountId,deviceId);
   return authorized(role,value);
  },
  resume:role=>authorized(role),
  async recover(){await clear();return 'REAUTHENTICATION_REQUIRED';},
  async logout(){const value=await store.read().catch(()=>null);await clear();try{await identity.revoke(value);}catch{/* Local logout is authoritative even if remote revocation is unreachable. */}},
  getStatus:()=>session.getStatus()
 });
}
