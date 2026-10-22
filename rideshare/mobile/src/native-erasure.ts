import * as SecureStore from 'expo-secure-store';

// Device-local private data erasure is independent of backend retention obligations.
// Fail closed on any keystore or keychain error: never claim completed erasure.
const keys=['liftd.preview.identity.tokens.v1','liftd.preview.session.v1'] as const;
export async function eraseNativePrivateState(){
 const results=await Promise.allSettled(keys.map(key=>SecureStore.deleteItemAsync(key,{keychainService:key})));
 if(results.some(result=>result.status==='rejected'))throw Error('LOCAL_ERASURE_INCOMPLETE');
 return Object.freeze({localErasureComplete:true,backendDeletionNotClaimed:true});
}
export const retainedSecretKeyNames=Object.freeze([...keys]);
