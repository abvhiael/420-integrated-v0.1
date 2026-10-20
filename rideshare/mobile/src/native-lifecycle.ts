import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {createNativeIdentity} from './native-identity';
import {createNativeSession} from './native-session';
import {createMobileLifecycle} from './mobile-lifecycle.mjs';
import {eraseNativePrivateState} from './native-erasure';

const vaultKey='liftd.preview.identity.tokens.v1';
const vault={
 async read(){const value=await SecureStore.getItemAsync(vaultKey,{keychainService:vaultKey});if(!value)return null;try{return JSON.parse(value);}catch{await SecureStore.deleteItemAsync(vaultKey,{keychainService:vaultKey});throw Error('IDENTITY_STORE_CORRUPT');}},
 async write(value:unknown){await SecureStore.setItemAsync(vaultKey,JSON.stringify(value),{keychainService:vaultKey,keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
 async clear(){await SecureStore.deleteItemAsync(vaultKey,{keychainService:vaultKey});}
};
type IdentityConfig={authorizationEndpoint:string;tokenEndpoint:string;revocationEndpoint:string;clientId:string;redirectUri:string};
export function createNativeLifecycle(config?:{identity:IdentityConfig;sessionEndpoint:string}){
 if(!config||!config.identity||!config.sessionEndpoint)throw Error('AUTHORITY_NOT_CONFIGURED');
 const lifecycle=createMobileLifecycle({identity:createNativeIdentity(config.identity),session:createNativeSession(config.sessionEndpoint),store:vault});
 return Object.freeze({...lifecycle,
  async logout(){try{await lifecycle.logout();}finally{await eraseNativePrivateState();}},
  async recover(){try{return await lifecycle.recover();}finally{await eraseNativePrivateState();}}
 });
}
