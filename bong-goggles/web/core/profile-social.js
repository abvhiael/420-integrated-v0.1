const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const FRIEND_STATES=new Set(['none','pending-outgoing','pending-incoming','friends']);
const FOLLOW_STATES=new Set(['none','pending-outgoing','pending-incoming','following','followed-by','mutual']);

function addr(value,label='address'){
  if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error(`valid ${label} required`);
  return value.toLowerCase();
}

export function normalizeProfileProjection(value={}){
  const account=addr(value.account,'profile account');
  return Object.freeze({
    account,
    profileId:value.profileId??null,
    profileType:value.profileType??null,
    displayName:value.displayName??null,
    displayNameHash:value.displayNameHash??value.handleHash??null,
    bio:value.bio??null,
    bioHash:value.bioHash??null,
    avatarRef:value.avatarRef??null,
    bannerRef:value.bannerRef??null,
    metadataRoot:value.metadataRoot??value.metadataHash??null,
    status:value.status??(value.active===true?'ACTIVE':value.active===false?'INACTIVE':null),
    active:value.active===true||value.status==='ACTIVE',
    exists:value.exists!==false,
    canonical:true
  });
}

export function normalizeRelationshipProjection(value={}){
  const viewer=addr(value.viewer,'viewer');
  const subject=addr(value.subject,'subject');
  const friendState=String(value.friendState??'none');
  const followState=String(value.followState??'none');
  if(!FRIEND_STATES.has(friendState)) throw new Error('invalid friend state');
  if(!FOLLOW_STATES.has(followState)) throw new Error('invalid follow state');
  return Object.freeze({
    viewer,subject,friendState,followState,
    blockedByViewer:value.blockedByViewer===true,
    blockedBySubject:value.blockedBySubject===true,
    muted:value.muted===true,
    muteScopes:Number(value.muteScopes??0),
    muteExpiresAt:value.muteExpiresAt??null,
    friendRequestId:value.friendRequestId??null,
    followRequestId:value.followRequestId??null,
    subjectFollowPolicy:value.subjectFollowPolicy??null,
    subjectFriendRequestPolicy:value.subjectFriendRequestPolicy??null,
    canonical:true
  });
}

export function relationshipActions(profile,relationship,{connected=false,canWrite=false,isOwnProfile=false}={}){
  if(!profile?.exists) return Object.freeze([]);
  if(isOwnProfile) return Object.freeze([{id:'edit-profile',label:'Edit profile',enabled:canWrite,authority:'wallet'}]);
  if(!relationship) return Object.freeze([]);
  const actions=[];
  const blocked=relationship.blockedByViewer||relationship.blockedBySubject;

  if(relationship.blockedByViewer){
    actions.push({id:'unblock',label:'Unblock',enabled:canWrite,authority:'wallet'});
    return Object.freeze(actions);
  }
  if(relationship.blockedBySubject){
    return Object.freeze([{id:'blocked',label:'Unavailable',enabled:false,authority:'canonical'}]);
  }

  if(relationship.friendState==='friends') actions.push({id:'remove-friend',label:'Remove friend',enabled:canWrite,authority:'wallet'});
  if(relationship.friendState==='none') actions.push({id:'friend-request',label:'Add friend',enabled:canWrite&&profile.active,authority:'wallet'});
  if(relationship.friendState==='pending-outgoing') actions.push({id:'friend-cancel',label:'Cancel friend request',enabled:canWrite,authority:'wallet'});
  if(relationship.friendState==='pending-incoming'){
    actions.push({id:'friend-accept',label:'Accept friend request',enabled:canWrite,authority:'wallet'});
    actions.push({id:'friend-decline',label:'Decline',enabled:canWrite,authority:'wallet'});
  }

  if(['following','mutual'].includes(relationship.followState)) actions.push({id:'unfollow',label:'Unfollow',enabled:canWrite,authority:'wallet'});
  if(['none','followed-by'].includes(relationship.followState)) actions.push({id:'follow',label:'Follow',enabled:canWrite&&profile.active,authority:'wallet'});
  if(relationship.followState==='pending-outgoing') actions.push({id:'follow-cancel',label:'Cancel follow request',enabled:canWrite,authority:'wallet'});
  if(relationship.followState==='pending-incoming'){
    actions.push({id:'follow-accept',label:'Accept follow',enabled:canWrite,authority:'wallet'});
    actions.push({id:'follow-decline',label:'Decline follow',enabled:canWrite,authority:'wallet'});
  }

  actions.push({id:relationship.muted?'unmute':'mute',label:relationship.muted?'Unmute':'Mute',enabled:connected&&canWrite,authority:'wallet'});
  actions.push({id:'block',label:'Block',enabled:connected&&canWrite,authority:'wallet',destructive:true});
  return Object.freeze(actions);
}

export function socialLists({viewer,relationships=[],profiles=[]}={}){
  const me=addr(viewer,'viewer');
  const byAccount=new Map(profiles.map(profile=>{
    const normalized=normalizeProfileProjection(profile);
    return [normalized.account,normalized];
  }));
  const out={friends:[],followers:[],following:[],blocked:[],muted:[]};

  for(const raw of relationships){
    const r=normalizeRelationshipProjection(raw);
    if(r.viewer!==me) continue;
    const profile=byAccount.get(r.subject)??Object.freeze({account:r.subject,exists:true,active:true,canonical:true});
    if(r.friendState==='friends') out.friends.push(profile);
    if(['followed-by','mutual','pending-incoming'].includes(r.followState)) out.followers.push(profile);
    if(['following','mutual','pending-outgoing'].includes(r.followState)) out.following.push(profile);
    if(r.blockedByViewer) out.blocked.push(profile);
    if(r.muted) out.muted.push(profile);
  }
  for(const list of Object.values(out)) list.sort((a,b)=>a.account.localeCompare(b.account));
  return Object.freeze(out);
}

export function applyCanonicalRefresh(previous,next){
  const profile=normalizeProfileProjection(next.profile);
  const relationship=next.relationship?normalizeRelationshipProjection(next.relationship):null;
  return Object.freeze({
    profile,
    relationship,
    source:'canonical-refresh',
    optimistic:false,
    replaces:previous??null
  });
}
