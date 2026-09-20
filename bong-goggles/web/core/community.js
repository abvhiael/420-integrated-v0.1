const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const GROUP_PRIVACY=new Set(['PUBLIC','PRIVATE']);
const JOIN_POLICY=new Set(['OPEN','APPROVAL_REQUIRED','DISABLED']);
const MEMBER_STATE=new Set(['NONE','PENDING','ACTIVE','REMOVED']);
const MEMBER_ROLE=new Set(['NONE','MEMBER','MODERATOR','ADMIN','OWNER']);
const RSVP_STATE=new Set(['GOING','INTERESTED','NOT_GOING']);
const HOST_TYPE=new Set(['PROFILE','PAGE','GROUP']);
const EVENT_VISIBILITY=new Set(['PUBLIC','GROUP_ONLY','INVITE_ONLY']);

function addr(value,label,{optional=false}={}){
  if(optional&&(value===null||value===undefined||value==='')) return null;
  if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error(`valid ${label} required`);
  return value.toLowerCase();
}
function h32(value,label,{optional=false}={}){
  if(optional&&(value===null||value===undefined||value==='')) return null;
  if(typeof value!=='string'||!HEX32.test(value)) throw new Error(`valid ${label} required`);
  return value.toLowerCase();
}
function enumValue(value,set,label,fallback=null){
  const v=value===undefined||value===null?fallback:String(value).toUpperCase();
  if(!set.has(v)) throw new Error(`invalid ${label}`);
  return v;
}
function time(value,label,{allowZero=true}={}){
  const n=Number(value??0);
  if(!Number.isSafeInteger(n)||(allowZero?n<0:n<=0)) throw new Error(`invalid ${label}`);
  return n;
}

export function normalizePage(value={}){
  return Object.freeze({
    pageId:h32(value.pageId,'pageId'),
    profileAccount:addr(value.profileAccount,'profileAccount'),
    owner:addr(value.owner,'owner'),
    metadataRoot:h32(value.metadataRoot,'metadataRoot',{optional:true}),
    createdAt:time(value.createdAt,'createdAt'),
    updatedAt:time(value.updatedAt,'updatedAt'),
    active:value.active===true,
    exists:value.exists!==false,
    canonical:true
  });
}

export function normalizeGroup(value={}){
  return Object.freeze({
    groupId:h32(value.groupId,'groupId'),
    owner:addr(value.owner,'owner'),
    privacy:enumValue(value.privacy,GROUP_PRIVACY,'group privacy','PUBLIC'),
    joinPolicy:enumValue(value.joinPolicy,JOIN_POLICY,'join policy','DISABLED'),
    metadataRoot:h32(value.metadataRoot,'metadataRoot',{optional:true}),
    createdAt:time(value.createdAt,'createdAt'),
    updatedAt:time(value.updatedAt,'updatedAt'),
    active:value.active===true,
    exists:value.exists!==false,
    canonical:true
  });
}

export function normalizeGroupMember(value={}){
  return Object.freeze({
    groupId:h32(value.groupId,'groupId'),
    account:addr(value.account,'member account'),
    state:enumValue(value.state,MEMBER_STATE,'member state','NONE'),
    role:enumValue(value.role,MEMBER_ROLE,'member role','NONE'),
    joinedAt:time(value.joinedAt,'joinedAt'),
    updatedAt:time(value.updatedAt,'updatedAt'),
    canonical:true
  });
}

export function normalizeEvent(value={}){
  return Object.freeze({
    eventId:h32(value.eventId,'eventId'),
    owner:addr(value.owner,'owner'),
    hostType:enumValue(value.hostType,HOST_TYPE,'host type','PROFILE'),
    hostAccount:addr(value.hostAccount,'hostAccount',{optional:true}),
    hostId:h32(value.hostId,'hostId',{optional:true}),
    visibility:enumValue(value.visibility,EVENT_VISIBILITY,'event visibility','PUBLIC'),
    metadataRoot:h32(value.metadataRoot,'metadataRoot',{optional:true}),
    startsAt:time(value.startsAt,'startsAt',{allowZero:false}),
    endsAt:time(value.endsAt,'endsAt',{allowZero:false}),
    createdAt:time(value.createdAt,'createdAt'),
    updatedAt:time(value.updatedAt,'updatedAt'),
    active:value.active===true,
    exists:value.exists!==false,
    canonical:true
  });
}

export function normalizeRsvp(value={}){
  return Object.freeze({
    eventId:h32(value.eventId,'eventId'),
    account:addr(value.account,'rsvp account'),
    state:enumValue(value.state,RSVP_STATE,'rsvp state'),
    canonical:true
  });
}

export function communityActions({kind,record,viewer=null,walletView=null,member=null,rsvp=null,blocked=false}={}){
  const canWrite=walletView?.connected===true&&walletView?.canWrite===true;
  const account=viewer?addr(viewer,'viewer'):null;
  if(!record?.exists||record?.active!==true) return Object.freeze([]);
  if(blocked) return Object.freeze([{id:'blocked',label:'Unavailable',enabled:false,authority:'canonical'}]);
  const actions=[];

  if(kind==='page'){
    if(account===record.owner) actions.push({id:'page-edit',label:'Edit page',enabled:canWrite,authority:'wallet'});
    return Object.freeze(actions);
  }

  if(kind==='group'){
    const own=account===record.owner;
    const m=member?normalizeGroupMember(member):null;
    if(own) actions.push({id:'group-edit',label:'Edit group',enabled:canWrite,authority:'wallet'});
    if(!own&&(!m||m.state==='NONE'||m.state==='REMOVED')){
      if(record.joinPolicy==='OPEN') actions.push({id:'group-join',label:'Join group',enabled:canWrite,authority:'wallet'});
      if(record.joinPolicy==='APPROVAL_REQUIRED') actions.push({id:'group-join',label:'Request to join',enabled:canWrite,authority:'wallet'});
    }
    if(!own&&m?.state==='PENDING') actions.push({id:'group-leave',label:'Cancel join request',enabled:canWrite,authority:'wallet'});
    if(!own&&m?.state==='ACTIVE') actions.push({id:'group-leave',label:'Leave group',enabled:canWrite,authority:'wallet'});
    if(own) actions.push({id:'group-members',label:'Manage members',enabled:true,authority:'canonical'});
    return Object.freeze(actions);
  }

  if(kind==='event'){
    if(account===record.owner) actions.push({id:'event-edit',label:'Edit event',enabled:canWrite,authority:'wallet'});
    if(record.visibility!=='INVITE_ONLY'){
      for(const state of ['GOING','INTERESTED','NOT_GOING']){
        actions.push({id:`rsvp:${state}`,label:state.replace('_',' '),enabled:canWrite&&rsvp?.state!==state,authority:'wallet'});
      }
    }
    return Object.freeze(actions);
  }
  throw new Error('unsupported community kind');
}

export function prepareCommunityIntent({kind,action,actor,recordId=null,payload={}}={}){
  const map={
    'page:create':'BongGogglesCommunityRegistry420.createPage',
    'page:update':'BongGogglesCommunityRegistry420.updatePage',
    'group:create':'BongGogglesCommunityRegistry420.createGroup',
    'group:update':'BongGogglesCommunityRegistry420.updateGroup',
    'group:join':'BongGogglesCommunityRegistry420.joinGroup',
    'group:approve':'BongGogglesCommunityRegistry420.approveGroupMember',
    'group:remove':'BongGogglesCommunityRegistry420.removeGroupMember',
    'event:create':'BongGogglesCommunityRegistry420.createEvent',
    'event:update':'BongGogglesCommunityRegistry420.updateEvent',
    'event:rsvp':'BongGogglesCommunityRegistry420.setRSVP'
  };
  const key=`${kind}:${action}`;
  if(!map[key]) throw new Error('unsupported community action');
  return Object.freeze({
    schema:'bg-community-intent-v1',
    actor:addr(actor,'actor'),
    kind:String(kind),
    action:String(action),
    recordId:h32(recordId,'recordId',{optional:true}),
    payload:Object.freeze({...payload}),
    canonicalAction:map[key],
    requiresWalletApproval:true,
    authoritative:false
  });
}

export function normalizeCommunityDirectory({pages=[],groups=[],events=[]}={}){
  return Object.freeze({
    pages:Object.freeze(pages.map(normalizePage).filter(x=>x.active)),
    groups:Object.freeze(groups.map(normalizeGroup).filter(x=>x.active)),
    events:Object.freeze(events.map(normalizeEvent).filter(x=>x.active).sort((a,b)=>a.startsAt-b.startsAt)),
    canonical:true
  });
}

export function canViewGroup(group,member=null){
  const g=normalizeGroup(group);
  if(!g.active) return false;
  if(g.privacy==='PUBLIC') return true;
  return member?normalizeGroupMember(member).state==='ACTIVE':false;
}

export function applyCommunityRefresh(next){
  const result={source:'canonical-refresh',optimistic:false};
  if(next.page) result.page=normalizePage(next.page);
  if(next.group) result.group=normalizeGroup(next.group);
  if(next.member) result.member=normalizeGroupMember(next.member);
  if(next.event) result.event=normalizeEvent(next.event);
  if(next.rsvp) result.rsvp=normalizeRsvp(next.rsvp);
  return Object.freeze(result);
}
