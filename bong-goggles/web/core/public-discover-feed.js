// BG-19.18: anonymous, read-only browser adapter. Enable only after BG-19.16/17
// canonical policy and HTTPS deployment evidence has been independently approved.
const HEX32=/^0x[0-9a-f]{64}$/i;
const ADDRESS=/^0x[0-9a-f]{40}$/i;
const MAX_ITEMS=20;
const ID='bg-social-read-v1';
const ITEM_KEYS=new Set(['objectId','author','objectType','status','audienceType','contentHash','version']);
const OBJECT_KEYS=new Set(['apiVersion','data']);
const DATA_KEYS=new Set(['feedClass','items','snapshotBlock','hasMore','authoritative']);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).every(k=>keys.has(k));

// The server supplies authorization, moderation, finality and reorg checks. A
// browser cannot infer permission from PUBLIC flags or hashes on its own.
export function validatePublicDiscoverResponse(value,{limit=MAX_ITEMS}={}){
  if(!exact(value,OBJECT_KEYS)||value.apiVersion!==ID||!exact(value.data,DATA_KEYS))throw Error('invalid public feed envelope');
  const data=value.data;
  if(data.feedClass!=='DISCOVER'||data.authoritative!==false||data.hasMore!==false||
     !Number.isSafeInteger(data.snapshotBlock)||data.snapshotBlock<0||
     !Array.isArray(data.items)||data.items.length>limit)throw Error('invalid public feed page');
  const seen=new Set();
  const items=data.items.map(item=>{
    if(!exact(item,ITEM_KEYS)||Object.keys(item).length!==ITEM_KEYS.size||
       !HEX32.test(item.objectId??'')||!ADDRESS.test(item.author??'')||
       !HEX32.test(item.contentHash??'')||item.objectType!=='POST'||
       item.status!=='ACTIVE'||item.audienceType!=='PUBLIC'||
       !Number.isSafeInteger(item.version)||item.version<1)throw Error('invalid public feed object');
    const id=item.objectId.toLowerCase();
    if(seen.has(id))throw Error('duplicate public feed object');
    seen.add(id);
    return Object.freeze({objectId:id,author:item.author.toLowerCase(),contentHash:item.contentHash.toLowerCase(),
      objectType:'POST',status:'ACTIVE',audienceType:'PUBLIC',version:item.version});
  });
  return Object.freeze({feedClass:'DISCOVER',items:Object.freeze(items),snapshotBlock:data.snapshotBlock,
    hasMore:false,authoritative:false,canonical:false,source:'qualified-public-server'});
}

export function createPublicDiscoverFeedReader({config,fetchImpl=fetch,limit=MAX_ITEMS}={}){
  const enabled=config?.features?.publicDiscoverFeed===true&&typeof config.socialApiUrl==='string'&&
    Number.isSafeInteger(limit)&&limit>0&&limit<=MAX_ITEMS;
  let generation=0;
  let active=null;
  function invalidate(){generation++;active?.abort();active=null;}
  async function read(){
    invalidate();
    if(!enabled)return Object.freeze({status:'unavailable',data:null});
    const current=++generation;
    const controller=new AbortController();active=controller;
    try{
      const url=new URL('/v1/public-feed',`${config.socialApiUrl}/`);
      url.searchParams.set('feedClass','DISCOVER');url.searchParams.set('limit',String(limit));
      const response=await fetchImpl(url.toString(),{method:'GET',signal:controller.signal,
        credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{accept:'application/json'}});
      if(current!==generation||controller.signal.aborted)return Object.freeze({status:'stale',data:null});
      if(!response?.ok||!response.headers?.get('content-type')?.toLowerCase().includes('application/json'))
        return Object.freeze({status:'unavailable',data:null});
      const payload=await response.json();
      if(current!==generation||controller.signal.aborted)return Object.freeze({status:'stale',data:null});
      return Object.freeze({status:'ready',data:validatePublicDiscoverResponse(payload,{limit}),authoritative:false});
    }catch{return Object.freeze({status:current!==generation||controller.signal.aborted?'stale':'unavailable',data:null});}
    finally{if(active===controller)active=null;}
  }
  return Object.freeze({read,invalidate,enabled});
}
