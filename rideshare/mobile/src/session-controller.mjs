// LIFTd mobile session authority: transport is injected, never inferred from token contents.
// A trusted HTTPS backend must return a freshly verified status for each admitted role.
const roles=new Set(['rider','driver']);
const clean=(v)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
export class MobileSessionError extends Error{constructor(code){super(code);this.name='MobileSessionError';this.code=code;}}
const deny=c=>{throw new MobileSessionError(c);};
export function validateStatus(status,{now,expectedNonce,expectedAccount,expectedDevice}){
 if(!status||typeof status!=='object'||Array.isArray(status)||!Number.isSafeInteger(now))deny('INVALID_STATUS');
 const allowed=['active','role','subject','accountId','deviceId','sessionId','expiresAt','nonce','recoveryEpoch'];
 if(Reflect.ownKeys(status).some(k=>!allowed.includes(k)))deny('INVALID_STATUS');
 if(status.active!==true||!roles.has(status.role)||![status.subject,status.accountId,status.deviceId,status.sessionId,status.nonce].every(clean)||!Number.isSafeInteger(status.recoveryEpoch)||status.recoveryEpoch<0||!Number.isSafeInteger(status.expiresAt)||status.expiresAt<=now||status.expiresAt-now>60)deny('SESSION_UNAVAILABLE');
 if(status.nonce!==expectedNonce||status.accountId!==expectedAccount||status.deviceId!==expectedDevice)deny('SESSION_BINDING_MISMATCH');
 return Object.freeze({...status});
}
export function createMobileSession({store,authority,clock=()=>Math.floor(Date.now()/1000),nonce=/** @returns {string} */ (()=>'')}){
 if(!store||typeof store.read!=='function'||typeof store.write!=='function'||typeof store.clear!=='function'||typeof authority!=='function'||typeof clock!=='function'||typeof nonce!=='function')deny('INVALID_CONFIGURATION');
 let generation=0,current=null;
 const drop=async()=>{generation++;current=null;await store.clear();};
 const revalidate=async(requestedRole)=>{
  const op=++generation; current=null;
  let credential;try{credential=await store.read();}catch{deny('STORE_UNAVAILABLE');}
  if(op!==generation)deny('STALE_OPERATION');
  if(!credential||typeof credential!=='object'||!clean(credential.accountId)||!clean(credential.deviceId)||typeof credential.accessToken!=='string'||credential.accessToken.length<10||credential.accessToken.length>32768){await drop();deny('NO_SESSION');}
  let requestNonce=nonce();
  if(!clean(requestNonce))deny('AUTHORITY_UNAVAILABLE');
  let answer;
  try{answer=await authority({accessToken:credential.accessToken,nonce:requestNonce,accountId:credential.accountId,deviceId:credential.deviceId});}
  catch{if(op===generation)current=null;deny('AUTHORITY_UNAVAILABLE');}
  if(op!==generation)deny('STALE_OPERATION');
  let status;
  try{status=validateStatus(answer,{now:clock(),expectedNonce:requestNonce,expectedAccount:credential.accountId,expectedDevice:credential.deviceId});}
  catch(e){await drop();throw e;}
  if(status.role!==requestedRole){await drop();deny('ROLE_DENIED');}
  current=status;return status;
 };
 return Object.freeze({
  async begin(credentials){if(!credentials||!clean(credentials.accountId)||!clean(credentials.deviceId)||typeof credentials.accessToken!=='string'||credentials.accessToken.length<10||credentials.accessToken.length>32768)deny('INVALID_CREDENTIAL');await drop();await store.write(credentials);return true;},
  revalidate,
  async logout(){await drop();},
  async recover(){await drop();return 'REAUTHENTICATION_REQUIRED';},
  getStatus(){if(!current||current.expiresAt<=clock())return null;return current;},
  async withFreshRole(role,action){const s=await revalidate(role);if(typeof action!=='function')deny('INVALID_ACTION');return action(s);}
 });
}
