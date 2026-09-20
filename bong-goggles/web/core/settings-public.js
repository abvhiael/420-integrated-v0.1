// BG-19.11: local presentation preferences do not modify canonical profile, block or notification policy.
const ADDRESS=/^0x[0-9a-f]{40}$/i, ID=/^0x[0-9a-f]{64}$/i;
const PUBLIC_TYPES=new Set(['profile','post','page','group','event']);
const PRIVATE_ROUTES=new Set(['friends','messages','notifications','games','rewards','safety','settings']);
export const DEFAULT_VIEW_PREFERENCES=Object.freeze({textSize:'normal',contrast:'system',motion:'system'});
export function normalizeViewPreferences(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('invalid view preferences');
 const value={...DEFAULT_VIEW_PREFERENCES};
 for(const key of Object.keys(raw)){if(!(key in value))throw new Error('unsupported view preference');value[key]=raw[key];}
 if(!['normal','large'].includes(value.textSize)||!['system','high'].includes(value.contrast)||!['system','reduce'].includes(value.motion))throw new Error('invalid view preference');
 return Object.freeze(value);
}
export function publicDocumentPolicy({type,id,visibility,status,moderation='CLEAR',blocked=false,accessVerified=false}={}){
 if(!PUBLIC_TYPES.has(type))throw new Error('unsupported public document type');
 const validId=type==='profile'?ADDRESS.test(id??''):ID.test(id??'');
 if(!validId)throw new Error('invalid public document identifier');
 const active=status==='ACTIVE'&&visibility==='PUBLIC'&&moderation==='CLEAR'&&blocked===false&&accessVerified===true;
 const gone=['WITHDRAWN','DELETED'].includes(status);
 return Object.freeze({path:`/${type}/${id.toLowerCase()}`,httpStatus:active?200:gone?410:404,indexable:active,publiclyRenderable:active,robots:active?'index,follow':'noindex,nofollow',authoritative:false});
}
export function documentIndexingPolicy(pathname='/',documentPolicy=null){
 const segment=String(pathname).split('/')[1];
 if(PRIVATE_ROUTES.has(segment))return 'noindex,nofollow';
 if(PUBLIC_TYPES.has(segment)&&String(pathname).split('/')[2])return documentPolicy?.publiclyRenderable===true?'index,follow':'noindex,nofollow';
 return 'noindex,nofollow'; // shell and placeholder routes are not public canonical documents
}
export function safePublicMetadata({title,description,documentPolicy}={}){
 if(documentPolicy?.publiclyRenderable!==true)return Object.freeze({title:'Bong Goggles',description:'',robots:'noindex,nofollow'});
 const clean=value=>String(value??'').replace(/[<>\u0000-\u001f]/g,' ').slice(0,160);
 return Object.freeze({title:clean(title)||'Bong Goggles',description:clean(description),robots:'index,follow'});
}
export function settingsHandoffs({walletUrl=null,notificationsUrl=null}={}){
 const validated=url=>{if(typeof url!=='string')return null;try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash?parsed.href:null;}catch{return null;}};
 return Object.freeze({wallet:validated(walletUrl),notifications:validated(notificationsUrl)});
}
