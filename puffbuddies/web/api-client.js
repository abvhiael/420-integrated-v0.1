const JSON_HEADERS={"Accept":"application/json","Content-Type":"application/json"};

export class ApiError extends Error {
  constructor(message,status=0){ super(message); this.name="ApiError"; this.status=status; }
}

export function createApiClient({apiBase,tokenProvider,fetchImpl=globalThis.fetch}){
  if(typeof apiBase!=="string" || !apiBase.startsWith("/") || apiBase.includes("://")){
    throw new Error("same-origin PuffBuddies API base required");
  }
  if(typeof fetchImpl!=="function") throw new Error("fetch implementation required");

  const request=async(path,{method="GET",body}={})=>{
    if(!path.startsWith("/")) throw new Error("relative API path required");
    const token=String(tokenProvider?.()||"");
    const headers={...JSON_HEADERS};
    if(token) headers.Authorization=`Bearer ${token}`;
    let response;
    try{
      response=await fetchImpl(apiBase+path,{
        method,headers,credentials:"same-origin",cache:"no-store",redirect:"error",
        body:body===undefined?undefined:JSON.stringify(body)
      });
    }catch(error){
      throw new ApiError("PuffBuddies API unavailable",0,{cause:error});
    }
    if(!response?.ok) throw new ApiError("PuffBuddies request denied",response?.status||0);
    if(response.status===204) return null;
    const data=await response.json();
    if(!data || typeof data!=="object") throw new ApiError("Invalid PuffBuddies response",502);
    return data;
  };

  return {
    session:()=>request("/session"),
    eligibility:()=>request("/eligibility"),
    profile:()=>request("/profile"),
    uploadMedia:async(file)=>{
      if(!(file instanceof Blob)) throw new Error("profile media file required");
      if(file.size<=0 || file.size>10*1024*1024) throw new Error("profile media must be 1..10MiB");
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("unsupported profile media type");
      const token=String(tokenProvider?.()||"");
      const headers={}; if(token) headers.Authorization=`Bearer ${token}`;
      const form=new FormData();form.set("media",file);
      let response;
      try{response=await fetchImpl(apiBase+"/profile/media",{method:"POST",headers,credentials:"same-origin",cache:"no-store",redirect:"error",body:form})}
      catch(error){throw new ApiError("PuffBuddies media API unavailable",0)}
      if(!response?.ok) throw new ApiError("PuffBuddies media upload denied",response?.status||0);
      const data=await response.json();
      if(!data || typeof data!=="object") throw new ApiError("Invalid media response",502);
      return data;
    },
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
    premium:()=>request("/premium/entitlements")
  };
}
