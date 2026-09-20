// BG-19.19: private social read HTTP contract. Not a listening server.
// The deployer must provide independently qualified session, canonical, policy and
// cursor-key providers. A wallet address in a URL, body or header is NOT proof of identity.
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const HASH=/^0x[0-9a-f]{64}$/i;
const CLASSES=new Set(['HOME','FRIENDS','FOLLOWING']);
const RESOURCES=new Set(['profile','relationships','community']);
const HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Origin'});
const respond=(status,body)=>Object.freeze({status,headers:HEADERS,body:Object.freeze(body)});
const fail=(status,code)=>respond(status,{apiVersion:'bg-scoped-social-read-v1',error:{code}});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(value,allowed)=>plain(value)&&Object.keys(value).every(key=>allowed.includes(key));
const validItem=item=>keys(item,['objectId','author','objectType','status','audienceType','contentHash','version'])&&
  Object.keys(item).length===7&&HASH.test(item.objectId??'')&&ADDRESS.test(item.author??'')&&
  item.objectType==='POST'&&item.status==='ACTIVE'&&item.audienceType==='PUBLIC'&&
  HASH.test(item.contentHash??'')&&Number.isSafeInteger(item.version)&&item.version>0;
const safeScalar=value=>value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=256||Number.isSafeInteger(value);
// Restrictive allowlist: never forward arbitrary materialized records or arbitrary
// policy-supplied publicDto keys, even if a callback incorrectly approves them.
function safeScopedRecord(resource,item){
  if(!plain(item))return false;
  if(resource==='profile')return keys(item,['account','displayName','avatarHash','active'])&&
    ADDRESS.test(item.account??'')&&typeof item.displayName==='string'&&item.displayName.length<=80&&
    (item.avatarHash===null||item.avatarHash===undefined||HASH.test(item.avatarHash))&&item.active===true;
  if(resource==='relationships')return keys(item,['account','relationshipType','active'])&&
    ADDRESS.test(item.account??'')&&['FRIEND','FOLLOWER','FOLLOWING'].includes(item.relationshipType)&&item.active===true;
  if(resource==='community')return keys(item,['communityId','title','active'])&&
    HASH.test(item.communityId??'')&&typeof item.title==='string'&&item.title.length<=120&&item.active===true;
  return false;
}
const isSafeCursor=value=>value===null||typeof value==='string'&&value.length>0&&value.length<=2048&&/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(value);
/**
 * enabled alone is insufficient: a configured guard must be supplied by the
 * deployment. `credential` is an opaque transport secret supplied by a trusted
 * authenticated HTTP boundary; never accept a viewer/account query override.
 * The caller owns TLS, exact origin, credential parsing, CSRF and rate limits.
 */
export function createScopedSocialHttp({enabled=false,scopedRead,pagination}={}){
 const configured=enabled===true&&scopedRead?.configured===true&&pagination?.configured===true&&
  typeof scopedRead.read==='function'&&typeof pagination.read==='function';
 async function route({method,requestUrl,credential}={}){
  if(!configured)return fail(503,'unavailable');
  if(method!=='GET')return fail(405,'method_not_allowed');
  if(typeof requestUrl!=='string'||requestUrl.length>4096||!requestUrl.startsWith('/')||requestUrl.startsWith('//'))return fail(400,'invalid_request');
  let url;
  try{url=new URL(requestUrl,'http://internal.invalid');}catch{return fail(400,'invalid_request');}
  if(url.username||url.password||url.hash)return fail(400,'invalid_request');
  const feed=url.pathname==='/v1/scoped/feed';
  const single=url.pathname==='/v1/scoped/record';
  if(!feed&&!single)return fail(404,'not_found');
  const params=url.searchParams;
  const allowed=feed?['feedClass','limit','cursor']:['resource','subject'];
  if([...params.keys()].some(k=>!allowed.includes(k)||params.getAll(k).length!==1))return fail(400,'invalid_request');
  if(typeof credential!=='string'||credential.length<1||credential.length>4096)return fail(401,'unauthorized');
  if(feed){
   const feedClass=params.get('feedClass');
   const size=params.get('limit')??'20';
   const cursor=params.get('cursor');
   if(!CLASSES.has(feedClass)||!/^[1-9][0-9]?$/.test(size)||Number(size)>50||!isSafeCursor(cursor))return fail(400,'invalid_request');
   try{
    const result=await pagination.read({credential,feedClass,limit:Number(size),cursor});
    if(result?.status!=='ready')return fail(503,'unavailable');
    const data=result.data;
    if(!plain(data)||data.feedClass!==feedClass||!Array.isArray(data.items)||data.items.length>Number(size)||
      data.items.some(item=>!validItem(item))||!Number.isSafeInteger(data.snapshotBlock)||data.snapshotBlock<0||
      typeof data.hasMore!=='boolean'||!isSafeCursor(data.cursor)||data.hasMore!==(data.cursor!==null)||
      data.authoritative!==false)return fail(503,'unavailable');
    return respond(200,{apiVersion:'bg-scoped-social-read-v1',data:{feedClass,items:data.items.map(item=>({objectId:item.objectId,author:item.author,objectType:item.objectType,status:item.status,audienceType:item.audienceType,contentHash:item.contentHash,version:item.version})),snapshotBlock:data.snapshotBlock,hasMore:data.hasMore,cursor:data.cursor,authoritative:false}});
   }catch{return fail(503,'unavailable');}
  }
  const resource=params.get('resource');
  const subject=params.get('subject');
  if(!RESOURCES.has(resource)||resource==='community'&&!HASH.test(subject??'')||
    resource==='relationships'&&subject!==null||resource==='profile'&&subject!==null&&!ADDRESS.test(subject))return fail(400,'invalid_request');
  try{
   const result=await scopedRead.read({credential,resource,subject});
   if(result?.status!=='ready')return fail(503,'unavailable');
   const data=result.data;
   if(!plain(data)||!Array.isArray(data.records)||data.records.length>20||
      data.records.some(item=>!safeScopedRecord(resource,item))||
      !Number.isSafeInteger(data.snapshotBlock)||data.snapshotBlock<0||data.authoritative!==false)return fail(503,'unavailable');
   return respond(200,{apiVersion:'bg-scoped-social-read-v1',data:{resource,records:data.records.map(item=>({...item})),snapshotBlock:data.snapshotBlock,authoritative:false}});
  }catch{return fail(503,'unavailable');}
 }
 return Object.freeze({configured,route});
}
