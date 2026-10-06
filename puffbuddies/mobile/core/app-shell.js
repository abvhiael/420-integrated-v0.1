import {MobileState} from "./state.js";
import {createMobileApi,MobileApiError} from "./api-client.js";
import {SecureSessionAdapter,validateDeviceMedia,validatePushRegistration,parseAppLink} from "./platform-adapters.js";
import {assertNoClientAuthority} from "./screen-model.js";

export class PuffBuddiesMobileShell {
  constructor({runtime,nativeBridge,fetchImpl}){
    if(runtime?.deploymentStatus!=="repository-qualified-not-deployed")throw new Error("unexpected mobile deployment status");
    this.runtime=runtime;this.state=new MobileState();this.secure=new SecureSessionAdapter(nativeBridge);
    this.api=runtime.apiBase?createMobileApi({apiBase:runtime.apiBase,sessionProvider:()=>this.secure.load(),fetchImpl}):null;
  }
  requireApi(){if(!this.api)throw new MobileApiError("PuffBuddies API is not configured",0);return this.api;}
  apply(data){if(Number.isSafeInteger(data?.authorityGeneration))this.state.applyGeneration(data.authorityGeneration);return data;}
  async restoreSession(){this.state.sessionPresent=Boolean(await this.secure.load());this.state.clearDerived();return this.state.sessionPresent;}
  async saveSession(token){await this.secure.save(token);this.state.sessionPresent=true;this.state.clearDerived();}
  async signOut(){await this.secure.clear();this.state.signOut();}
  async resume(){this.state.onResume();if(this.api){const data=this.apply(await this.api.session());return data;}return null;}
  async action(name,args={}){
    assertNoClientAuthority(name);const api=this.requireApi();
    try{
      switch(name){
        case "CHECK_ELIGIBILITY":return this.apply(await api.eligibility());
        case "LOAD_PROFILE":return this.apply(await api.profile());
        case "SAVE_PROFILE":return this.apply(await api.saveProfile(args.profile));
        case "REFRESH_DISCOVERY":return this.apply(await api.discovery());
        case "LIKE":case "PASS":return this.apply(await api.relationshipAction(args.profileId,name));
        case "REFRESH_MATCHES":return this.apply(await api.matches());
        case "OPEN_MESSAGING":return this.apply(await api.messengerEntry(args.profileId));
        case "REFRESH_NOTIFICATIONS":return this.apply(await api.notifications());
        case "BLOCK":case "REPORT":case "UNMATCH":return this.apply(await api.safetyAction(args.profileId,name,args.details||{}));
        case "VISIBILITY":return this.apply(await api.visibility(args.visibility));
        case "DEACTIVATE":case "REACTIVATE":case "DELETE_REQUEST":return this.apply(await api.lifecycle(name));
        case "CHECK_DELETION":return this.apply(await api.deletionStatus());
        case "REFRESH_PREMIUM":return this.apply(await api.premium());
        default:throw new Error("unsupported mobile action");
      }
    }catch(error){
      if(error instanceof MobileApiError && [401,403,409,410].includes(error.status))this.state.clearDerived();
      throw error;
    }
  }
  async uploadMedia(input){const media=validateDeviceMedia(input);return this.apply(await this.requireApi().uploadMedia(media.ref,media.mimeType,media.sizeBytes));}
  async registerPush(input){const p=validatePushRegistration(input);return this.apply(await this.requireApi().registerPush(p.deviceRef,p.platform));}
  appLink(url){return parseAppLink(url);}
}
