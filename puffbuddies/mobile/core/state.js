export class MobileState {
  constructor(){
    this.authorityGeneration=0;
    this.sessionPresent=false;
    this.eligibility=null;
    this.profile=null;
    this.discovery=[];
    this.matches=[];
    this.notifications=[];
    this.premium=[];
    this.screen="entry";
  }
  applyGeneration(next){
    if(!Number.isSafeInteger(next)||next<0) throw new Error("invalid authority generation");
    if(next<this.authorityGeneration) throw new Error("stale authority generation");
    if(next>this.authorityGeneration){this.authorityGeneration=next;this.clearDerived();}
  }
  clearDerived(){this.discovery=[];this.matches=[];this.notifications=[];this.premium=[];}
  signOut(){this.authorityGeneration=0;this.sessionPresent=false;this.eligibility=null;this.profile=null;this.clearDerived();this.screen="entry";}
  onResume(){this.clearDerived();}
  setScreen(screen){
    const allowed=new Set(["entry","profile","discovery","matches","notifications","safety","settings","premium"]);
    if(!allowed.has(screen)) throw new Error("unsupported mobile screen");
    this.screen=screen;
  }
}
