export class SecureSessionAdapter {
  constructor(nativeBridge){this.native=nativeBridge;}
  async load(){const value=await this.native.secureGet("puffbuddies.session");return typeof value==="string"?value:"";}
  async save(token){
    if(typeof token!=="string"||token.length===0||token.length>4096)throw new Error("bounded session token required");
    await this.native.secureSet("puffbuddies.session",token);
  }
  async clear(){await this.native.secureDelete("puffbuddies.session");}
}
export function validateDeviceMedia({ref,mimeType,sizeBytes}){
  if(typeof ref!=="string"||!ref.startsWith("device-media:"))throw new Error("opaque device media reference required");
  if(!["image/jpeg","image/png","image/webp"].includes(mimeType))throw new Error("unsupported profile media type");
  if(!Number.isSafeInteger(sizeBytes)||sizeBytes<=0||sizeBytes>10*1024*1024)throw new Error("profile media must be 1..10MiB");
  return Object.freeze({ref,mimeType,sizeBytes});
}
export function validatePushRegistration(value){
  if(!value||!["ios","android"].includes(value.platform))throw new Error("supported push platform required");
  if(typeof value.deviceRef!=="string"||!/^device:[A-Za-z0-9._~-]{8,160}$/.test(value.deviceRef))throw new Error("opaque device reference required");
  return Object.freeze({platform:value.platform,deviceRef:value.deviceRef});
}
export function parseAppLink(value){
  const url=new URL(value);
  if(url.protocol!=="https:"||!url.hostname)throw new Error("verified HTTPS app link required");
  const allowed=new Set(["/matches","/messages","/notifications","/profile","/settings"]);
  if(!allowed.has(url.pathname))throw new Error("unsupported PuffBuddies app-link route");
  return Object.freeze({route:url.pathname,entry:url.searchParams.get("entry")});
}
