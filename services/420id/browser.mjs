// Standard WebAuthn browser adapter; no wallet, storage, or automatic login.
function bytes(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw new Error('Invalid challenge or user handle');
 const s=atob(value.replaceAll('-','+').replaceAll('_','/')+'=');
 return Uint8Array.from(s,c=>c.charCodeAt(0));
}
function base64(value){
 if(!(value instanceof ArrayBuffer)||!value.byteLength)throw new Error('Missing authenticator response');
 return btoa(Array.from(new Uint8Array(value),v=>String.fromCharCode(v)).join(''));
}
function browserAPI(options,env){
 if(!env.isSecureContext||env.location?.origin!=='https://'+options.rpId||!env.navigator?.credentials)throw new Error('420ID secure origin required');
 return env.navigator.credentials;
}
export async function create420IDPasskey(options,env=globalThis){
 const api=browserAPI(options,env);
 const credential=await api.create({publicKey:{challenge:bytes(options.challenge),rp:{id:options.rpId,name:'420ID'},user:{id:bytes(options.userHandle),name:options.userName,displayName:options.userName},pubKeyCredParams:[{type:'public-key',alg:-7}],authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'},attestation:'none',timeout:300000}});
 if(credential?.type!=='public-key')throw new Error('Passkey registration cancelled');
 return {challengeId:options.challengeId,credentialId:base64(credential.rawId),clientDataJSON:base64(credential.response.clientDataJSON),attestationObject:base64(credential.response.attestationObject)};
}
export async function authenticate420IDPasskey(options,env=globalThis){
 const api=browserAPI(options,env);
 const credential=await api.get({publicKey:{challenge:bytes(options.challenge),rpId:options.rpId,userVerification:'required',timeout:300000}});
 if(credential?.type!=='public-key')throw new Error('Passkey authentication cancelled');
 return {challengeId:options.challengeId,credentialId:base64(credential.rawId),clientDataJSON:base64(credential.response.clientDataJSON),authenticatorData:base64(credential.response.authenticatorData),signature:base64(credential.response.signature),userHandle:base64(credential.response.userHandle)};
}
