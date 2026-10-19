import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {createNativeIdentity} from './native-identity';
import {createNativeSession} from './native-session';
import {createMobileLifecycle} from './mobile-lifecycle.mjs';

const vaultKey='liftd.preview.identity.tokens.v1';
const vault={
 async read(){const value=await SecureStore.getItemAsync(vaultKey,{keychainService:vaultKey});return value?JSON.parse(value):null;},
 async write(value:unknown){await SecureStore.setItemAsync(vaultKey,JSON.stringify(value),{keychainService:vaultKey,keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
 async clear(){await SecureStore.deleteItemAsync(vaultKey,{keychainService:vaultKey});}
};
type IdentityConfig={authorizationEndpoint:string;tokenEndpoint:string;revocationEndpoint:string;clientId:string;redirectUri:string};
export function createNativeLifecycle(config?:{identity:IdentityConfig;sessionEndpoint:string}){
 if(!config||!config.identity||!config.sessionEndpoint)throw Error('AUTHORITY_NOT_CONFIGURED');
 return createMobileLifecycle({identity:createNativeIdentity(config.identity),session:createNativeSession(config.sessionEndpoint),store:vault});
}
