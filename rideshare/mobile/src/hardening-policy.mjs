// MBL-6 pure policy boundaries; native adapters remain responsible for OS storage and links.
const MAX_URL=2048;
export function parseExternalLink(input){
 if(typeof input!=='string'||input.length>MAX_URL)return null;
 let url;
 try{url=new URL(input);}catch{return null;}
 if(url.protocol!=='liftd-preview:'||url.hostname!=='callback'||url.port||url.username||url.password||url.hash)return null;
 if(url.pathname!==''&&url.pathname!=='/')return null;
 const keys=[...url.searchParams.keys()];
 if(keys.length===0||keys.length>3||new Set(keys).size!==keys.length||keys.some(k=>!['code','state','error'].includes(k)))return null;
 if(url.searchParams.has('error'))return null;
 if(keys.length!==2||!url.searchParams.get('code')||!url.searchParams.get('state'))return null;
 if(url.searchParams.get('code').length>1024||url.searchParams.get('state').length>256)return null;
 // Never turn a link into a role, endpoint, session, payment or dispatch command.
 return Object.freeze({kind:'identity-callback',url:url.toString()});
}
export function isSafeDiagnostic(value){
 if(typeof value!=='string')return false;
 return !/(?:bearer\s+|access[_-]?token|refresh[_-]?token|password|authorization|coordinate|latitude|longitude|deviceid|accountid|privatekey|incident|payment[_-]?intent)/i.test(value);
}
export function requireFreshRecovery({foreground,sessionVerified,serverConfirmed,commandId,confirmedCommandId}){
 if(foreground!==true||sessionVerified!==true||serverConfirmed!==true)throw Error('RECOVERY_REVALIDATION_REQUIRED');
 if(typeof commandId!=='string'||!commandId||commandId!==confirmedCommandId)throw Error('RECOVERY_COMMAND_MISMATCH');
 return Object.freeze({status:'server-confirmed',commandId});
}
export function safeResumeState(){
 return Object.freeze({role:null,availability:false,tripAuthorized:false,paymentAuthorized:false,requiresServerRevalidation:true});
}
