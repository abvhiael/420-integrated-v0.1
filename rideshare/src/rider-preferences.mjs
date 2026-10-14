// L02.2: authoritative, scoped rider preference service. Storage adapter must be durable.
const FIELDS = Object.freeze(['largeText','reducedMotion','screenReaderHints','contactMethod','tripNotifications','marketingConsent','locationHistoryConsent']);
const DEFAULTS = Object.freeze({largeText:false,reducedMotion:false,screenReaderHints:false,contactMethod:'none',tripNotifications:false,marketingConsent:false,locationHistoryConsent:false});
export class PreferenceError extends Error { constructor(code,status=400){ super(code); this.code=code; this.status=status; } }
const fail=(code,status)=>{throw new PreferenceError(code,status);};
const validAccount=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const isRecord=x=>x!==null&&typeof x==='object'&&[null,Object.prototype].includes(Object.getPrototypeOf(x));
export function validatePreferences(candidate){
  if(!isRecord(candidate)||Reflect.ownKeys(candidate).some(k=>typeof k!=='string'||!FIELDS.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(candidate,k),'value')))fail('INVALID_PREFERENCES');
  const result={...DEFAULTS};
  for(const key of FIELDS){
    if(!Object.hasOwn(candidate,key))continue;
    const value=candidate[key];
    if(key==='contactMethod'){if(!['none','email','sms'].includes(value))fail('INVALID_PREFERENCES');}
    else if(typeof value!=='boolean')fail('INVALID_PREFERENCES');
    result[key]=value;
  }
  if(result.contactMethod==='none'&&result.tripNotifications)fail('CONTACT_REQUIRED');
  return Object.freeze(result);
}
export function createRiderPreferenceService({authorize,store}){
  if(typeof authorize!=='function'||!store||typeof store.read!=='function'||typeof store.compareAndSwap!=='function'||typeof store.delete!=='function')fail('AUTHORITY_UNAVAILABLE',503);
  async function check(token,accountId){
    if(!validAccount(accountId))fail('INVALID_ACCOUNT');
    if(typeof token!=='string'||!token)fail('UNAUTHENTICATED',401);
    // The independent L01 authenticator MUST validate active session, recovery, role and account resource.
    let allowed;
    try { allowed=await authorize(token,{action:'account.preferences',resource:'account:'+accountId}); }
    catch{ fail('FORBIDDEN',403); }
    if(!allowed || allowed.role!=='rider' || allowed.action!=='account.preferences' || allowed.resource!=='account:'+accountId || allowed.accountId!==accountId)fail('FORBIDDEN',403);
  }
  return Object.freeze({
    async read(token,accountId){
      await check(token,accountId);
      const row=await store.read(accountId);
      return Object.freeze({preferences:validatePreferences(row?.preferences??{}),revision:row?.revision??0});
    },
    async update(token,accountId,request){
      await check(token,accountId);
      if(!isRecord(request)||Reflect.ownKeys(request).some(k=>typeof k!=='string'||!['preferences','expectedRevision'].includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(request,k),'value')))fail('INVALID_REQUEST');
      const {preferences,expectedRevision}=request;
      if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)fail('INVALID_REVISION');
      const valid=validatePreferences(preferences);
      const wrote=await store.compareAndSwap(accountId,expectedRevision,valid);
      if(!wrote)fail('STALE_REVISION',409);
      return Object.freeze({preferences:valid,revision:expectedRevision+1});
    },
    async erase(token,accountId){
      await check(token,accountId);
      await store.delete(accountId);
      return Object.freeze({deleted:true});
    }
  });
}
export const defaultRiderPreferences=DEFAULTS;
