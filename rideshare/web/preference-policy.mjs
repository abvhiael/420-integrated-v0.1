// UI preflight only. Server preference schema and signed-session authorization are authoritative.
export const DEFAULT_RIDER_PREFERENCES=Object.freeze({
  largeText:false,reducedMotion:false,screenReaderHints:false,
  contactMethod:'none',tripNotifications:false,marketingConsent:false,locationHistoryConsent:false
});
export function checkRiderPreferences(value){
  if(!value||typeof value!=='object'||![null,Object.prototype].includes(Object.getPrototypeOf(value)))throw Error('Invalid preferences');
  const result={...DEFAULT_RIDER_PREFERENCES};
  for(const key of Reflect.ownKeys(value)){
    if(typeof key!=='string'||!Object.hasOwn(result,key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))throw Error('Invalid field');
    const v=value[key];
    if(key==='contactMethod'){if(!['none','email','sms'].includes(v))throw Error('Invalid method');}
    else if(typeof v!=='boolean')throw Error('Invalid preference value');
    result[key]=v;
  }
  if(result.tripNotifications&&result.contactMethod==='none')throw Error('Contact method required');
  return Object.freeze(result);
}
