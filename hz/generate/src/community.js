// HZ-GCA-8: deterministic app-owned community coordinator; no Wallet or Creative authority is inferred.
import { randomUUID } from "node:crypto";
const requireId = (value) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value)) throw new Error("INVALID_REFERENCE");
  return value;
};
const authorized = (session, account) => {
  if (!session || session.verified !== true || session.scope !== "420hz:community:write" ||
      session.accountRef !== account || !session.domain || session.expiresAt <= Date.now()) throw new Error("UNAUTHORIZED");
  return account;
};
const assertVisibility = v => { if (!["PRIVATE","UNLISTED","PUBLIC"].includes(v)) throw new Error("INVALID_VISIBILITY"); };
export class CommunityStore420 {
  constructor({ source, now = () => Date.now(), production = false, verifySession = null } = {}) {
    if (!source || typeof source.creator !== "function" || typeof source.recording !== "function") throw new Error("SOURCE_REQUIRED");
    if (production && typeof verifySession !== "function") throw new Error("SESSION_VERIFIER_REQUIRED");
    this.production = production; this.verifySession = verifySession;
    this.source = source; this.now = now; this.follows = new Map(); this.favorites = new Map();
    this.playlists = new Map(); this.shares = new Map(); this.blocks = new Set();
    this.mutes = new Set(); this.reports = new Map(); this.preferences = new Map(); this.sequence = 0;
  }
  actor(session) { const actor = authorized(session, requireId(session?.accountRef));
    if (this.production && this.verifySession({session,actor,scope:"420hz:community:write",audience:"420hz",at:this.now()}) !== true) throw new Error("SESSION_UNVERIFIED");
    return actor; }
  creator(id) { const x = this.source.creator(requireId(id)); if (!x || x.status !== "ACTIVE" || x.visibility !== "PUBLIC") throw new Error("SOURCE_UNAVAILABLE"); return x; }
  recording(id, allowUnlisted = false) {
    const x = this.source.recording(requireId(id));
    if (!x || x.status !== "ACTIVE" || !["PUBLIC", ...(allowUnlisted ? ["UNLISTED"] : [])].includes(x.visibility) || x.rightsBlocked) throw new Error("SOURCE_UNAVAILABLE");
    return x;
  }
  relation(map, session, id, enabled, kind) {
    const actor = this.actor(session); requireId(id);
    if (kind === "follow") this.creator(id); else this.recording(id, true);
    const key = JSON.stringify([actor,id]);
    const previous = map.get(key); if (previous?.enabled === enabled) return {...previous};
    const record = {actor,id,enabled,revision:(previous?.revision || 0)+1,kind};
    map.set(key,record); return {...record};
  }
  follow(session, creatorId, enabled = true) { return this.relation(this.follows,session,creatorId,enabled,"follow"); }
  favorite(session, recordingId, enabled = true) { return this.relation(this.favorites,session,recordingId,enabled,"favorite"); }
  createPlaylist(session, {title,visibility = "PRIVATE",id = randomUUID()} = {}) {
    const owner = this.actor(session); requireId(id); assertVisibility(visibility);
    if (typeof title !== "string" || !title.trim() || title.length > 120) throw new Error("INVALID_TITLE");
    if (this.playlists.has(id)) throw new Error("PLAYLIST_EXISTS");
    const p = {id,owner,title,visibility,revision:1,deleted:false,items:[]};
    this.playlists.set(id,p); return structuredClone(p);
  }
  owned(session,id) {
    const actor=this.actor(session),p=this.playlists.get(requireId(id));
    if (!p || p.deleted) throw new Error("NOT_FOUND");
    if (p.owner !== actor) throw new Error("FORBIDDEN");
    return p;
  }
  updatePlaylist(session,id,revision,patch) {
    const p=this.owned(session,id);
    if (p.revision !== revision) throw new Error("STALE_REVISION");
    if (!patch || Object.keys(patch).some(k=>!["title","visibility"].includes(k))) throw new Error("INVALID_PATCH");
    if (patch.visibility !== undefined) assertVisibility(patch.visibility);
    if (patch.title !== undefined && (typeof patch.title !== "string" || !patch.title.trim() || patch.title.length > 120)) throw new Error("INVALID_TITLE");
    Object.assign(p,patch);p.revision++; return structuredClone(p);
  }
  addItem(session,id,recordingId,itemId) {
    const p=this.owned(session,id);this.recording(recordingId,true);requireId(itemId);
    const old=p.items.find(i=>i.id===itemId);
    if (old) { if (old.recordingId!==recordingId) throw new Error("IDEMPOTENCY_CONFLICT"); return structuredClone(p); }
    if (p.items.some(i=>i.recordingId===recordingId)) throw new Error("DUPLICATE_RECORDING");
    p.items.push({id:itemId,recordingId});p.revision++;return structuredClone(p);
  }
  removeItem(session,id,itemId) {
    const p=this.owned(session,id);const before=p.items.length;
    p.items=p.items.filter(i=>i.id!==requireId(itemId));if(before!==p.items.length)p.revision++;
    return structuredClone(p);
  }
  deletePlaylist(session,id) {const p=this.owned(session,id);p.deleted=true;p.items=[];p.revision++;return {id,deleted:true};}
  readPlaylist(id,{viewer,viaDirectLink=false}={}) {
    const p=this.playlists.get(requireId(id));
    if (!p || p.deleted || (p.visibility==="PRIVATE" && p.owner!==viewer) || (p.visibility==="UNLISTED" && !viaDirectLink && p.owner!==viewer)) throw new Error("NOT_FOUND");
    const copy=structuredClone(p);
    copy.items=copy.items.filter(i=>{try {this.recording(i.recordingId,viaDirectLink||viewer===p.owner);return true;}catch{return false;}});
    return copy;
  }
  discovery() {return [...this.playlists.values()].filter(p=>!p.deleted && p.visibility==="PUBLIC").flatMap(p=>{try{return [this.readPlaylist(p.id)];}catch{return [];}});}
  preference(session,{follows=false,favorites=false,playlists=false}={}) {
    const actor=this.actor(session);const p={follows:!!follows,favorites:!!favorites,playlists:!!playlists};this.preferences.set(actor,p);return {...p};
  }
  notificationEligible(account,kind) {return this.preferences.get(account)?.[kind]===true;}
  share(session,recordingId,shareId) {
    const actor=this.actor(session);this.recording(recordingId,true);requireId(shareId);
    const old=this.shares.get(shareId);
    if(old) {if(old.actor!==actor||old.recordingId!==recordingId)throw new Error("IDEMPOTENCY_CONFLICT");return {...old};}
    const value={id:shareId,actor,recordingId};this.shares.set(shareId,value);return {...value};
  }
  block(session,target,enabled=true) {const actor=this.actor(session);requireId(target);if(actor===target)throw new Error("SELF_BLOCK");const key=JSON.stringify([actor,target]);enabled?this.blocks.add(key):this.blocks.delete(key);return {actor,target,enabled};}
  mute(session,target,enabled=true) {const actor=this.actor(session);requireId(target);const key=JSON.stringify([actor,target]);enabled?this.mutes.add(key):this.mutes.delete(key);return {actor,target,enabled};}
  report(session,{targetType,targetId,reason,id}) {
    const actor=this.actor(session);requireId(targetId);requireId(id);
    if(!["CREATOR","RECORDING","PLAYLIST","ACCOUNT"].includes(targetType)||typeof reason!=="string"||reason.length<3||reason.length>1000)throw new Error("INVALID_REPORT");
    const existing=this.reports.get(id);
    if(existing) {if(existing.actor!==actor||existing.targetType!==targetType||existing.targetId!==targetId||existing.reason!==reason)throw new Error("IDEMPOTENCY_CONFLICT");return {...existing};}
    const report={id,actor,targetType,targetId,reason,status:"OPEN"};this.reports.set(id,report);return {...report};
  }
  activity() {
    // Rebuild from currently-active PUBLIC source facts, not notification or counter caches.
    const out=[];
    for(const v of this.follows.values()) if(v.enabled) {try {this.creator(v.id);if(!this.blocks.has(JSON.stringify([v.actor,v.id])))out.push({type:"FOLLOW",id:JSON.stringify([v.actor,v.id]),revision:v.revision,creatorId:v.id});}catch{}}
    for(const p of this.discovery())out.push({type:"PLAYLIST",id:p.id,revision:p.revision});
    return out;
  }
}
