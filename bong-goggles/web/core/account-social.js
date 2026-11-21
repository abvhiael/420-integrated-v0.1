import {escapeHtml,card,emptyState} from './design-system.js';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LIMITS={post:2000,comment:500,displayName:80,bio:500};
export function createAccountSocialClient({enabled=false,fetchImpl=fetch}={}){
 if(enabled!==true)return Object.freeze({enabled:false});
 async function request(path,{method='GET',body,signal}={}){
  if(!(path==='/auth/logout'||/^\/v1\/[a-z0-9/_-]+(?:\?cursor=[A-Za-z0-9_-]+)?$/.test(path))||
   path.startsWith('//')||path.includes('..'))throw new Error('Invalid account-social route');
  const response=await fetchImpl('/social-api'+path,{
   method,credentials:'same-origin',cache:'no-store',redirect:'error',signal,
   headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
   body:body===undefined?undefined:JSON.stringify(body)
  });
  // Render Free can return an HTML 502/503/504 during cold start. Preserve
  // the transport status so only read-only session/feed checks can recover.
  // Never reissue the caller's POST/PUT/DELETE or one-use login callback.
  if(method==='GET'&&[502,503,504].includes(response.status))
   return {status:response.status,data:null};
  const type=response.headers?.get?.('content-type')??'';
  if(!type.startsWith('application/json'))throw new Error('Social service response unavailable');
  const data=await response.json();
  if(!response.ok)return {status:response.status,data:null};
  return {status:response.status,data};
 }
 return Object.freeze({enabled:true,request});
}
const safeID=v=>typeof v==='string'&&ID.test(v);
function safePosts(v){
 if(!Array.isArray(v)||v.length>30)return null;
 const out=[];
 for(const p of v){
  if(!safeID(p?.id)||!safeID(p.author)||typeof p.body!=='string'||p.body.length>LIMITS.post*4||
     typeof p.displayName!=='string'||typeof p.createdAt!=='string'||
     !Number.isSafeInteger(p.reactions)||p.reactions<0)return null;
  out.push({id:p.id,author:p.author,displayName:p.displayName,body:p.body,createdAt:p.createdAt,reactions:p.reactions});
 }
 return out;
}
export function normalizeAccountSocialFeed(result){
 if(result?.source!=='bonggoggles-account-social'||result?.onChain!==false)return null;
 const posts=safePosts(result.posts);
 if(!posts||result.nextCursor!==null&&(!/^[A-Za-z0-9_-]{20,160}$/.test(result.nextCursor)))return null;
 return {posts,nextCursor:result.nextCursor};
}
const heading=title=>'<p class="eyebrow">Account-based · off-chain · wallet optional</p><h2>'+escapeHtml(title)+'</h2>';
function postMarkup(p,me,comments){
 const own=p.author===me;
 return '<article class="social-post"><header><strong>'+escapeHtml(p.displayName)+'</strong><small> '+escapeHtml(p.author.slice(0,8))+' · '+escapeHtml(p.createdAt)+'</small></header>'+
  '<p class="social-post__body">'+escapeHtml(p.body)+'</p>'+
  '<div class="actions"><button type="button" data-social-action="react" data-post-id="'+p.id+'">Like ('+p.reactions+')</button>'+
  '<button type="button" data-social-action="comments" data-post-id="'+p.id+'">Comments</button>'+
  '<button type="button" data-social-action="follow" data-subject-id="'+p.author+'" '+(own?'disabled':'')+'>Follow</button>'+
  '<button type="button" data-social-action="block" data-subject-id="'+p.author+'" '+(own?'disabled':'')+'>Block</button>'+
  '<button type="button" data-social-action="report" data-post-id="'+p.id+'">Report</button>'+
  (own?'<button type="button" data-social-action="delete" data-post-id="'+p.id+'">Delete</button>':'')+
  '</div>'+(Array.isArray(comments)?'<ul class="social-comments">'+comments.map(c=>'<li><strong>'+escapeHtml(c.displayName)+'</strong>: '+escapeHtml(c.body)+'</li>').join('')+'</ul>':'')+'<form data-social-comment="'+p.id+'"><label>Comment<textarea name="body" maxlength="500" required></textarea></label><button type="submit">Post comment</button></form></article>';
}
export function renderAccountSocial(state,{enabled=false}={}){
 if(!enabled)return card({title:'Account social not activated',eyebrow:'Wallet-independent BongGoggles',body:emptyState({title:'Unavailable',message:'The separate account-social backend and 420ID callback have not been qualified for this deployment. Existing on-chain features remain independent.'})});
 if(!state||state.status==='loading')return card({title:'Loading account social activity',body:'<p role="status">Checking your 420ID sign-in.</p>'});
 if(state.status==='guest')return card({title:'Join BongGoggles without a wallet',eyebrow:'420ID account',body:'<p>Sign in with email or passkey using 420ID. No wallet, blockchain transaction or token balance is required. Posts and interactions are off-chain and separate from the canonical on-chain social feed.</p><a class="ui-button" href="/social-api/auth/start">Sign in with 420ID</a>'});
 if(state.status!=='ready')return card({title:'Account social is unavailable',body:'<p role="status">'+(state.temporary?'The social service is temporarily unreachable and your session will be checked again automatically. ':'')+'420ID or the account-social service could not verify your session. No cached or private content is shown.</p><div class="actions"><a class="ui-button ui-button--primary" href="/social-api/auth/start">Sign in again with 420ID</a><button type="button" data-social-action="refresh">Retry session check</button></div>'});
 const profile=state.profile??{};
 return '<section class="account-social">'+heading('Your BongGoggles community')+
 '<p>Wallet-free conversations are off-chain, app-scoped and visible only to signed-in community members. Nothing here issues rewards or on-chain posts.</p>'+
 '<p>Signed in as <strong>'+escapeHtml(profile.displayName??'Member')+'</strong></p>'+
 '<form data-social-profile><label>Display name<input name="displayName" required maxlength="80" value="'+escapeHtml(profile.displayName??'Member')+'"></label>'+
 '<label>Bio<textarea name="bio" maxlength="500">'+escapeHtml(profile.bio??'')+'</textarea></label><button type="submit">Save profile</button></form>'+
 '<form data-social-post><label>Write a post<textarea name="body" required maxlength="2000"></textarea></label><button type="submit">Publish off-chain post</button></form>'+
 '<div class="actions"><a href="/account/messages" data-route="account-messages">Account messages</a> <a href="/account/games" data-route="account-games">Free account games</a> <a href="/account/xp" data-route="account-xp">Community XP</a> <a href="/account/monetization" data-route="account-monetization">Community programmes</a><button data-social-action="refresh" type="button">Refresh</button><button data-social-action="logout" type="button">Sign out</button></div>'+
 (state.notice?'<p role="status">'+escapeHtml(state.notice)+'</p>':'')+
 '<section aria-label="Community posts">'+(state.posts?.length?state.posts.map(p=>postMarkup(p,profile.subject,state.comments?.[p.id])).join(''):emptyState({title:'No community posts',message:'Only authenticated community posts appear here.'}))+'</section>'+
 (state.nextCursor?'<button type="button" data-social-action="more">Load more</button>':'')+'</section>';
}
// Home reuses the verified account-social DTO and post controls. It must never
// substitute canonical indexer objects or render private data before 420ID
// has freshly validated the active same-origin session.
export function renderHomeAccountSocial(state,{enabled=false}={}){
 const header='<header class="home-social__header"><div><p class="eyebrow">Wallet-free community · off-chain</p><h2>Community feed</h2></div><span class="home-social__badge">OFF-CHAIN</span></header>'+
  '<p class="home-social__intro">Posts here are stored in BongGoggles Account Social, not on the blockchain. Sign in with 420ID; a wallet is not needed. Blockchain publishing remains separate below.</p>';
 let content;
 if(!enabled){
  content=emptyState({title:'Account Social is not activated',message:'This deployment has not enabled the independent off-chain community feed.'});
 }else if(!state||state.status==='loading'){
  content='<p role="status">Checking your 420ID session and loading off-chain community posts…</p>';
 }else if(state.status==='guest'){
  content=emptyState({title:'Sign in to see community posts',message:'The off-chain community feed is available to signed-in BongGoggles members.'})+
   '<a class="ui-button" href="/social-api/auth/start">Sign in with 420ID</a>';
 }else if(state.status!=='ready'){
  content='<p role="status">'+(state.temporary?'The account service is starting; checking again automatically. ':'')+'Off-chain posts could not be verified. No cached or private content is shown.</p>'+
   '<div class="actions"><a class="ui-button ui-button--primary" href="/social-api/auth/start">Sign in again with 420ID</a><button type="button" data-social-action="refresh">Retry community feed</button></div>';
 }else{
  const profile=state.profile??{};
  const posts=Array.isArray(state.posts)?state.posts:[];
  content='<p class="home-social__member">Signed in as <strong>'+escapeHtml(profile.displayName??'Member')+'</strong></p>'+
   '<form data-social-post class="home-social__composer"><label>Share with the community<textarea name="body" maxlength="2000" required placeholder="What’s happening?"></textarea></label>'+
   '<div class="actions"><span>Off-chain community post · no wallet approval</span><button type="submit">Publish post</button></div></form>'+
   (state.notice?'<p role="status">'+escapeHtml(state.notice)+'</p>':'')+
   '<div class="home-social__actions"><a href="/social" data-route="social">My Account Social profile</a>'+
   '<button type="button" data-social-action="refresh">Refresh posts</button></div>'+
   '<section class="home-social__posts" aria-label="Off-chain community posts">'+
   (posts.length?posts.map(p=>postMarkup(p,profile.subject,state.comments?.[p.id])).join(''):
    emptyState({title:'No community posts yet',message:'Be the first to share something with the signed-in community.'}))+
   '</section>'+
   (state.nextCursor?'<button type="button" data-social-action="more">Load more off-chain posts</button>':'');
 }
 return '<section class="account-social home-social ui-card" aria-label="Wallet-free community feed">'+header+content+'</section>';
}

export function socialInput(value,kind){
 const max=LIMITS[kind];
 if(typeof value!=='string'||!max||value.trim()!==value||value.trim()===''&&kind!=='bio'||
  [...value].length>max||/[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))throw new Error('Invalid community content');
 return value;
}
export function isSubjectID(value){return safeID(value);}
