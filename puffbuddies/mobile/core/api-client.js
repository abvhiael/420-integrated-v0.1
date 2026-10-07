const mutationKey=()=>globalThis.crypto?.randomUUID?.()||`pb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export class MobileApiError extends Error {
  constructor(message,status=0){super(message);this.name="MobileApiError";this.status=status;}
}
function normalizeBase(value){
  if(typeof value!=="string") throw new Error("injected HTTPS PuffBuddies API required");
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||!url.hostname) throw new Error("HTTPS PuffBuddies API required");
  return url.href.replace(/\/$/,"");
}
export function createMobileApi({apiBase,sessionProvider,fetchImpl=globalThis.fetch}){
  const base=normalizeBase(apiBase);
  const request=async(path,{method="GET",body}={})=>{
    if(!path.startsWith("/")) throw new Error("relative API path required");
    const token=String(await sessionProvider?.()||"");
    const headers={"Accept":"application/json","Content-Type":"application/json"};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(method!=="GET")headers["Idempotency-Key"]=mutationKey();
    let response;
    try{response=await fetchImpl(base+path,{method,headers,cache:"no-store",redirect:"error",body:body===undefined?undefined:JSON.stringify(body)});}
    catch{throw new MobileApiError("PuffBuddies API unavailable",0)}
    if(!response?.ok)throw new MobileApiError("PuffBuddies request denied",response?.status||0);
    if(response.status===204)return null;
    const data=await response.json();if(!data||typeof data!=="object")throw new MobileApiError("Invalid PuffBuddies response",502);
    return data;
  };
  return {
    session:()=>request("/session"),
    eligibility:()=>request("/eligibility"),
    profile:()=>request("/profile"),
    saveProfile:(profile)=>request("/profile",{method:"PUT",body:{profile}}),
    discovery:()=>request("/discovery"),
    relationshipAction:(profileId,action)=>request("/relationships/action",{method:"POST",body:{profileId,action}}),
    matches:()=>request("/matches"),
    messengerEntry:(profileId)=>request("/messenger/entry",{method:"POST",body:{profileId}}),
    notifications:()=>request("/notifications"),
    safetyAction:(profileId,action,details={})=>request("/safety/action",{method:"POST",body:{profileId,action,details}}),
    visibility:(visibility)=>request("/profile/visibility",{method:"PUT",body:{visibility}}),
    lifecycle:(action)=>request("/lifecycle",{method:"POST",body:{action}}),
    deletionStatus:()=>request("/deletion/status"),
    verification:()=>request("/verification"),
    premium:()=>request("/premium/entitlements"),
    registerPush:(deviceRef,platform)=>request("/notifications/device",{method:"POST",body:{deviceRef,platform}}),
    unregisterPush:(deviceRef)=>request("/notifications/device",{method:"DELETE",body:{deviceRef}}),
    uploadMedia:(mediaRef,mimeType,sizeBytes)=>{
      if(!["image/jpeg","image/png","image/webp"].includes(mimeType)) throw new Error("unsupported profile media type");
      if(!Number.isSafeInteger(sizeBytes)||sizeBytes<=0||sizeBytes>10*1024*1024) throw new Error("profile media must be 1..10MiB");
      if(typeof mediaRef!=="string"||!mediaRef.startsWith("device-media:")) throw new Error("opaque device media reference required");
      return request("/profile/media",{method:"POST",body:{mediaRef,mimeType,sizeBytes}});
    }
  };
}
