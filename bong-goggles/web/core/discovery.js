const ID=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const SEARCH_TYPES=Object.freeze(['PROFILE','PAGE','GROUP','EVENT','POST','DISCOVERY']);
function id(v,name){if(typeof v!=='string'||!ID.test(v))throw new Error(`invalid ${name}`);return v.toLowerCase();}
function address(v,name){if(typeof v!=='string'||!ADDRESS.test(v))throw new Error(`invalid ${name}`);return v.toLowerCase();}
function uint(v,name,max=Number.MAX_SAFE_INTEGER){const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>max)throw new Error(`invalid ${name}`);return n;}
export function searchRequest({query='',type='ALL',cursor=null,limit=20}={}){
 const q=String(query).trim();if(!q||q.length>200)throw new Error('invalid search query');
 if(type!=='ALL'&&!SEARCH_TYPES.includes(type))throw new Error('invalid search type');
 if(cursor!==null&&(typeof cursor!=='string'||cursor.length>512))throw new Error('invalid search cursor');
 return Object.freeze({query:q,type,cursor,limit:uint(limit,'limit',100)||(()=>{throw new Error('invalid limit');})(),authoritative:false});
}
export function canonicalResult(record){
 const type=String(record?.type??'').toUpperCase();if(!SEARCH_TYPES.includes(type))throw new Error('invalid result type');
 const identifier=type==='PROFILE'?address(record.account,'account'):id(record.id,'result id');
 const publicResult=record.public===true&&record.accessible===true&&record.active===true&&record.blocked!==true&&record.hidden!==true;
 return Object.freeze({type,id:identifier,public:publicResult,canonical:true,title:String(record.title??'').slice(0,160),metadataRoot:record.metadataRoot? id(record.metadataRoot,'metadataRoot'):null});
}
export function canonicalLink(record){const r=canonicalResult(record);if(!r.public)return null;const route={PROFILE:'/profile?account=',PAGE:'/pages?id=',GROUP:'/groups?id=',EVENT:'/events?id=',POST:'/posts?id=',DISCOVERY:'/discover?subject='}[r.type];return route+encodeURIComponent(r.id);}
export function normalizeSearchPage({items=[],cursor=null,hasMore=false,query='',type='ALL',indexedBlock=null}={}){
 if(!Array.isArray(items))throw new Error('search results required');
 const records=items.map(canonicalResult).filter(item=>item.public);
 const seen=new Set();const unique=records.filter(item=>{const key=item.type+':'+item.id;if(seen.has(key))return false;seen.add(key);return true;});
 if(cursor!==null&&(typeof cursor!=='string'||cursor.length>512))throw new Error('invalid search cursor');
 return Object.freeze({items:Object.freeze(unique),cursor,hasMore:hasMore===true,query:String(query),type,indexedBlock,authoritative:false});
}
export function normalizeSubject(r){if(!r||r.exists!==true)throw new Error('canonical subject missing');return Object.freeze({subjectId:id(r.subjectId,'subjectId'),canonicalRef:id(r.canonicalRef,'canonicalRef'),subjectType:String(r.subjectType),metadataRoot:r.metadataRoot?id(r.metadataRoot,'metadataRoot'):null,status:String(r.status),submitter:address(r.submitter,'submitter'),canonical:true});}
export function normalizeReview(r){return Object.freeze({reviewId:id(r.reviewId,'reviewId'),subjectId:id(r.subjectId,'subjectId'),author:address(r.author,'author'),contentHash:id(r.contentHash,'contentHash'),ratingBps:uint(r.ratingBps,'ratingBps',10000),version:uint(r.version,'version'),active:r.active===true,canonical:true});}
export function normalizeCorrection(r){return Object.freeze({correctionId:id(r.correctionId,'correctionId'),subjectId:id(r.subjectId,'subjectId'),fieldId:id(r.fieldId,'fieldId'),proposedValueHash:id(r.proposedValueHash,'proposedValueHash'),evidenceHash:r.evidenceHash?id(r.evidenceHash,'evidenceHash'):null,canonical:true});}
export function normalizeVerification(r){return Object.freeze({verificationId:id(r.verificationId,'verificationId'),subjectId:id(r.subjectId,'subjectId'),verifier:address(r.verifier,'verifier'),propositionHash:id(r.propositionHash,'propositionHash'),subjectVersion:uint(r.subjectVersion,'subjectVersion'),supportsProposition:r.supportsProposition===true,canonical:true});}
export function prepareDiscoveryIntent({kind,actor,subjectId=null,contentHash=null,ratingBps=null,fieldId=null,proposedValueHash=null,evidenceHash=null,propositionHash=null,subjectVersion=null,supportsProposition=false}={}){
 const actions={review:'publishReview',withdraw:'withdrawReview',correction:'submitCorrection',verification:'attestVerification'};
 if(!actions[kind])throw new Error('unsupported discovery intent');const intent={schema:'bg-discovery-intent-v1',actor:address(actor,'actor'),subjectId:id(subjectId,'subjectId'),kind,canonicalAction:'BongGogglesDiscoveryRegistry420.'+actions[kind],requiresWalletApproval:true,authoritative:false};
 if(kind==='review'){intent.contentHash=id(contentHash,'contentHash');intent.ratingBps=uint(ratingBps,'ratingBps',10000);}
 if(kind==='correction'){intent.fieldId=id(fieldId,'fieldId');intent.proposedValueHash=id(proposedValueHash,'proposedValueHash');intent.evidenceHash=evidenceHash?id(evidenceHash,'evidenceHash'):null;}
 if(kind==='verification'){intent.propositionHash=id(propositionHash,'propositionHash');intent.subjectVersion=uint(subjectVersion,'subjectVersion');if(!intent.subjectVersion)throw new Error('invalid subjectVersion');intent.supportsProposition=supportsProposition===true;intent.evidenceHash=evidenceHash?id(evidenceHash,'evidenceHash'):null;}
 return Object.freeze(intent);
}
export function normalizeRecommendations(items=[]){if(!Array.isArray(items))throw new Error('invalid recommendations');return Object.freeze(items.map(item=>Object.freeze({result:canonicalResult(item.result),reason:String(item.reason??'Suggested').slice(0,100),rankSource:'non-authoritative recommendation'})).filter(item=>item.result.public));}
