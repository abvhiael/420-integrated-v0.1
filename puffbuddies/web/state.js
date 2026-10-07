export class ClientState {
  constructor(){
    this.sessionToken="";
    this.authorityGeneration=0;
    this.eligibility=null;
    this.profile=null;
    this.discovery=[];
    this.matches=[];
    this.notifications=[];
    this.premium=[];
    this.status="SIGNED_OUT";
  }
  setSessionToken(token){
    if(typeof token!=="string" || token.length>4096) throw new Error("bounded session token required");
    this.sessionToken=token;
    this.status=token?"SIGNED_IN":"SIGNED_OUT";
  }
  applyAuthorityGeneration(next){
    if(!Number.isSafeInteger(next) || next<0) throw new Error("invalid authority generation");
    if(next<this.authorityGeneration) throw new Error("stale authority generation");
    if(next>this.authorityGeneration){
      this.authorityGeneration=next;
      this.clearDerived();
    }
  }
  clearDerived(){
    this.discovery=[];
    this.matches=[];
    this.notifications=[];
    this.premium=[];
  }
  clearSession(){
    this.sessionToken="";
    this.authorityGeneration=0;
    this.eligibility=null;
    this.profile=null;
    this.clearDerived();
    this.status="SIGNED_OUT";
  }
  cacheDiscovery(items,generation){
    this.applyAuthorityGeneration(generation);
    this.discovery=Array.isArray(items)?items.slice():[];
  }
  cacheMatches(items,generation){
    this.applyAuthorityGeneration(generation);
    this.matches=Array.isArray(items)?items.slice():[];
  }
  cacheNotifications(items,generation){
    this.applyAuthorityGeneration(generation);
    this.notifications=Array.isArray(items)?items.slice():[];
  }
}

export const clientState=new ClientState();
