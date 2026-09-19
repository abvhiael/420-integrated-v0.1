const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
export const FEED_CLASSES=Object.freeze(['HOME','FRIENDS','FOLLOWING','DISCOVER']);
export const OBJECT_TYPES=Object.freeze(['POST','COMMENT','STORY','REPOST','QUOTE_POST']);
export const AUDIENCES=Object.freeze(['PUBLIC','FRIENDS','FOLLOWERS','CUSTOM']);

function address(value,label='address'){
  if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error(`valid ${label} required`);
  return value.toLowerCase();
}
function hex32(value,label,{optional=false}={}){
  if(optional&&(value===null||value===undefined||value==='')) return null;
  if(typeof value!=='string'||!HEX32.test(value)) throw new Error(`valid ${label} required`);
  return value.toLowerCase();
}
function integer(value,label,{min=0,max=Number.MAX_SAFE_INTEGER}={}){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<min||n>max) throw new Error(`invalid ${label}`);
  return n;
}

export function normalizeFeedItem(value={}){
  return Object.freeze({
    objectId:hex32(value.objectId,'objectId'),
    author:address(value.author,'author'),
    objectType:String(value.objectType??'POST'),
    status:String(value.status??'ACTIVE'),
    audienceType:String(value.audienceType??'PUBLIC'),
    audienceRef:hex32(value.audienceRef,'audienceRef',{optional:true}),
    parentId:hex32(value.parentId,'parentId',{optional:true}),
    sourceObjectId:hex32(value.sourceObjectId,'sourceObjectId',{optional:true}),
    contentHash:hex32(value.contentHash,'contentHash',{optional:true}),
    mediaRoot:hex32(value.mediaRoot,'mediaRoot',{optional:true}),
    version:integer(value.version??1,'version',{min:1}),
    createdAt:value.createdAt??null,
    updatedAt:value.updatedAt??null,
    promotionLabel:String(value.promotionLabel??value.label??'ORGANIC'),
    canonical:true
  });
}

export function normalizeFeedPage(value={}){
  if(!FEED_CLASSES.includes(String(value.feedClass??'HOME'))) throw new Error('invalid feed class');
  if(!Array.isArray(value.items??value.results)) throw new Error('feed items required');
  const items=(value.items??value.results).map(normalizeFeedItem)
    .filter(item=>item.status==='ACTIVE');
  return Object.freeze({
    feedClass:String(value.feedClass??'HOME'),
    items:Object.freeze(items),
    cursor:value.cursor??null,
    hasMore:value.hasMore===true,
    freshness:value.freshness??null,
    snapshotBlock:value.snapshotBlock??value.freshness?.indexedBlock??null,
    canonical:true
  });
}

export function createFeedCursorRequest({feedClass='HOME',cursor=null,limit=20}={}){
  if(!FEED_CLASSES.includes(feedClass)) throw new Error('invalid feed class');
  const size=integer(limit,'feed limit',{min:1,max:100});
  return Object.freeze({feedClass,cursor,limit:size,authoritative:false});
}

export function prepareComposerDraft({
  author,objectType='POST',text='',contentHash=null,mediaRoot=null,parentId=null,
  sourceObjectId=null,audienceType='PUBLIC',audienceRef=null,communityId=null,subjectRef=null
}={}){
  const normalizedType=String(objectType);
  if(!OBJECT_TYPES.includes(normalizedType)) throw new Error('unsupported social object type');
  if(!AUDIENCES.includes(String(audienceType))) throw new Error('unsupported audience');
  const body=String(text??'').trim();
  const media=hex32(mediaRoot,'mediaRoot',{optional:true});
  const content=hex32(contentHash,'contentHash',{optional:true});
  const parent=hex32(parentId,'parentId',{optional:true});
  const source=hex32(sourceObjectId,'sourceObjectId',{optional:true});
  if(['POST','COMMENT','STORY','QUOTE_POST'].includes(normalizedType)&&!body&&!content&&!media){
    throw new Error('content or media required');
  }
  if(normalizedType==='COMMENT'&&!parent) throw new Error('comment parent required');
  if(['REPOST','QUOTE_POST'].includes(normalizedType)&&!source) throw new Error('source object required');
  if(normalizedType==='REPOST'&&(body||content||media)) throw new Error('repost cannot add content or media');
  return Object.freeze({
    schema:'bg-composer-draft-v1',
    author:address(author,'author'),
    objectType:normalizedType,
    text:body,
    contentHash:content,
    mediaRoot:media,
    parentId:parent,
    sourceObjectId:source,
    audience:Object.freeze({
      audienceType:String(audienceType),
      audienceRef:hex32(audienceRef,'audienceRef',{optional:true})
    }),
    communityId:hex32(communityId,'communityId',{optional:true}),
    subjectRef:hex32(subjectRef,'subjectRef',{optional:true}),
    authoritative:false
  });
}

export function composerCanonicalAction(draft){
  if(draft.objectType==='REPOST') return 'BongGogglesSocialObjectRegistry420.repost';
  if(draft.objectType==='QUOTE_POST') return 'BongGogglesSocialObjectRegistry420.quotePost';
  return 'BongGogglesSocialObjectRegistry420.publish';
}

export function publicationState({draft,transaction=null,projection=null}={}){
  if(projection){
    const item=normalizeFeedItem(projection);
    return Object.freeze({status:'confirmed',canonical:true,item,draft});
  }
  if(transaction?.status==='reverted') return Object.freeze({status:'reverted',canonical:true,draft});
  if(transaction?.status==='rejected') return Object.freeze({status:'rejected',canonical:false,draft});
  if(transaction?.status==='pending') return Object.freeze({status:'pending',canonical:false,draft});
  return Object.freeze({status:'draft',canonical:false,draft});
}

export function prepareInteraction({actor,objectId,kind,reactionType=null,tagTarget=null,tagTargetType=null}={}){
  const base={actor:address(actor,'actor'),objectId:hex32(objectId,'objectId'),kind:String(kind),authoritative:false};
  const actions={
    reaction:'BongGogglesReactionRegistry420.setReaction',
    clearReaction:'BongGogglesReactionRegistry420.clearReaction',
    comment:'BongGogglesSocialObjectRegistry420.publish',
    repost:'BongGogglesSocialObjectRegistry420.repost',
    quote:'BongGogglesSocialObjectRegistry420.quotePost',
    tag:'BongGogglesTagRegistry420.createTag'
  };
  if(!actions[base.kind]) throw new Error('unsupported interaction');
  if(base.kind==='reaction'&&!reactionType) throw new Error('reaction type required');
  if(base.kind==='tag'){
    base.tagTarget=address(tagTarget,'tag target');
    base.tagTargetType=String(tagTargetType??'PROFILE');
  }
  return Object.freeze({...base,reactionType,canonicalAction:actions[base.kind]});
}

export function canonicalRefreshFeed(previous,next){
  const page=normalizeFeedPage(next);
  return Object.freeze({
    ...page,
    source:'canonical-refresh',
    optimistic:false,
    replaces:previous??null
  });
}

export function normalizeMediaUploadState({stage='idle',progress=0,mediaRoot=null,error=null}={}){
  const stages=new Set(['idle','preparing','uploading','verifying','registering','ready','failed']);
  if(!stages.has(stage)) throw new Error('invalid upload stage');
  const p=integer(progress,'upload progress',{min:0,max:100});
  return Object.freeze({
    stage,
    progress:p,
    mediaRoot:hex32(mediaRoot,'mediaRoot',{optional:true}),
    error:error?String(error):null,
    ready:stage==='ready'&&Boolean(mediaRoot),
    authoritative:false
  });
}
