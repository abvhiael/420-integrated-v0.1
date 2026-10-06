const BASELINE=new Set(["BLOCK","REPORT","UNMATCH","DEACTIVATE","DELETE_REQUEST"]);
export function mobileScreens(){
  return Object.freeze([
    {id:"entry",actions:["CHECK_SESSION","CHECK_ELIGIBILITY"]},
    {id:"profile",actions:["LOAD_PROFILE","SAVE_PROFILE","UPLOAD_MEDIA"]},
    {id:"discovery",actions:["REFRESH_DISCOVERY","LIKE","PASS"]},
    {id:"matches",actions:["REFRESH_MATCHES","OPEN_MESSAGING","UNMATCH"]},
    {id:"notifications",actions:["REFRESH_NOTIFICATIONS"]},
    {id:"safety",actions:["BLOCK","REPORT","UNMATCH"]},
    {id:"settings",actions:["VISIBILITY","DEACTIVATE","REACTIVATE","DELETE_REQUEST","CHECK_DELETION"]},
    {id:"premium",actions:["REFRESH_PREMIUM"]},
  ].map(x=>Object.freeze({...x,actions:Object.freeze(x.actions)})));
}
export function isBaselineAction(action){return BASELINE.has(action);}
export function assertNoClientAuthority(action){
  const forbidden=new Set(["FORCE_MATCH","FORCE_UNBLOCK","ADMIN_MATCH","BLOCK_OVERRIDE","UNSUSPEND","UNBAN"]);
  if(forbidden.has(action))throw new Error("mobile client cannot manufacture PuffBuddies authority");
  return true;
}
