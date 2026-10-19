import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {createMobileSession} from './session-controller.mjs';

const key='liftd.preview.session.v1';
const store={
 async read(){const value=await SecureStore.getItemAsync(key,{keychainService:key,requireAuthentication:false});return value?JSON.parse(value):null;},
 async write(value:unknown){await SecureStore.setItemAsync(key,JSON.stringify(value),{keychainService:key,keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
 async clear(){await SecureStore.deleteItemAsync(key,{keychainService:key});}
};
function pinnedAuthority(endpoint:string){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!url.hostname)throw Error('AUTHORITY_CONFIGURATION');
 return async ({accessToken,nonce,accountId,deviceId}:{accessToken:string,nonce:string,accountId:string,deviceId:string})=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);
  try{
   const response=await fetch(url.toString(),{method:'POST',redirect:'error',signal:controller.signal,headers:{'content-type':'application/json','authorization':`Bearer ${accessToken}`},body:JSON.stringify({nonce,accountId,deviceId})});
   if(response.status!==200||response.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')throw Error('AUTHORITY_UNAVAILABLE');
   const body=await response.text();if(body.length>4096)throw Error('AUTHORITY_UNAVAILABLE');
   return JSON.parse(body);
  }finally{clearTimeout(timer);}
 };
}
// No public environment variable can silently switch preview into production.
// Bootstrap must explicitly receive a trusted, approved endpoint from deployment assembly.
export function createNativeSession(approvedEndpoint?:string){
 if(!approvedEndpoint)throw Error('AUTHORITY_NOT_CONFIGURED');
 return createMobileSession({store,authority:pinnedAuthority(approvedEndpoint),nonce:()=>Crypto.getRandomBytes(24).reduce((s,v)=>s+v.toString(16).padStart(2,'0'),''),clock:()=>Math.floor(Date.now()/1000)});
}
