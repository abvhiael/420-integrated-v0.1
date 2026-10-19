// ARC-1.11: isolated, version-pinned, byte-verified same-origin static asset loader.
export class ArcadeAssetError extends Error{constructor(message){super(message);this.name='ArcadeAssetError';}}
const fail=s=>{throw new ArcadeAssetError(s)};
const GAME=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
const HASH=/^[a-f0-9]{64}$/;
const MIME=new Set(['image/png','image/jpeg','image/webp','image/svg+xml','audio/mpeg','audio/ogg','audio/wav','application/json','font/woff2']);
const KEY='/assets/arcade/';
const MAX_ASSET=16*1024*1024;
const MAX_TOTAL=100*1024*1024;
export function validateAssetManifest(manifest,{gameId,origin}){
 if(!GAME.test(gameId)||!manifest||manifest.gameId!==gameId||!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version)||!Array.isArray(manifest.assets)||manifest.assets.length>1000)fail('Invalid game manifest');
 if(typeof origin!=='string'||!/^https?:\/\//.test(origin))fail('Invalid origin');
 const ids=new Set(),paths=new Set();let total=0;
 const normalized=manifest.assets.map(asset=>{
  if(!asset||typeof asset.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(asset.id)||ids.has(asset.id)||typeof asset.path!=='string'||!asset.path.startsWith(KEY)||asset.path.includes('?')||asset.path.includes('#')||asset.path.includes('\\')||asset.path.split('/').some(p=>p==='..'||p==='.')||paths.has(asset.path))fail('Unsafe asset identity or path');
  if(!HASH.test(asset.sha256)||!MIME.has(asset.mime)||!Number.isSafeInteger(asset.bytes)||asset.bytes<1||asset.bytes>MAX_ASSET||!['APPROVED','LICENSED'].includes(asset.approval)||typeof asset.alt!=='string'||asset.alt.length>240)fail('Invalid asset integrity or rights data');
  total+=asset.bytes;if(total>MAX_TOTAL)fail('Manifest budget exceeded');
  ids.add(asset.id);paths.add(asset.path);
  const url=new URL(asset.path,origin);
  if(url.origin!==origin||url.pathname!==asset.path)fail('Cross-origin asset blocked');
  return Object.freeze({id:asset.id,path:asset.path,sha256:asset.sha256,mime:asset.mime,bytes:asset.bytes,alt:asset.alt,url:url.href});
 });
 return Object.freeze({gameId,version:manifest.version,assets:Object.freeze(normalized)});
}
export class ArcadeAssetLoader {
 #manifest;#entries=new Map();#size=0;#max;#fetch;#crypto;#controllers=new Set();#disposed=false;
 constructor({manifest,gameId,origin,fetch:fetcher,crypto,budgetBytes=MAX_TOTAL}){
  this.#manifest=validateAssetManifest(manifest,{gameId,origin});
  if(typeof fetcher!=='function'||typeof crypto?.subtle?.digest!=='function'||!Number.isInteger(budgetBytes)||budgetBytes<1||budgetBytes>MAX_TOTAL)throw new TypeError('Invalid asset dependencies');
  this.#fetch=fetcher;this.#crypto=crypto;this.#max=budgetBytes;
 }
 get gameId(){return this.#manifest.gameId;}
 get cacheBytes(){return this.#size;}
 get disposed(){return this.#disposed;}
 #entry(id){if(this.#disposed)fail('Loader disposed');const asset=this.#manifest.assets.find(a=>a.id===id);if(!asset)fail('Unknown asset');return asset;}
 async load(id,{signal}={}){
  const a=this.#entry(id);if(signal?.aborted)fail('Asset request aborted');
  if(this.#entries.has(id)){const b=this.#entries.get(id);this.#entries.delete(id);this.#entries.set(id,b);return b.slice(0);}
  const controller=new AbortController();this.#controllers.add(controller);
  const abort=()=>controller.abort();signal?.addEventListener?.('abort',abort,{once:true});
  try {
   const res=await this.#fetch(a.url,{signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',mode:'same-origin'});
   if(controller.signal.aborted||this.#disposed)fail('Asset request aborted');
   if(!res?.ok||res.type==='opaque'||res.redirected||res.url&&res.url!==a.url)fail('Untrusted asset response');
   const mime=res.headers?.get?.('content-type')?.split(';')[0]?.trim().toLowerCase();
   if(mime!==a.mime)fail('Content type mismatch');
   const length=res.headers?.get?.('content-length');
   if(length!==null&&length!==undefined&&(!/^[0-9]+$/.test(length)||Number(length)!==a.bytes))fail('Content length mismatch');
   const bytes=await res.arrayBuffer();
   if(controller.signal.aborted||this.#disposed)fail('Asset request aborted');
   if(bytes.byteLength!==a.bytes)fail('Asset size mismatch');
   const hash=await this.#crypto.subtle.digest('SHA-256',bytes);
   if(controller.signal.aborted||this.#disposed)fail('Asset request aborted');
   const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
   if(hex!==a.sha256)fail('Asset digest mismatch');
   if(a.bytes<=this.#max){
    while(this.#size+a.bytes>this.#max){const oldest=this.#entries.keys().next().value;const prior=this.#entries.get(oldest);this.#entries.delete(oldest);this.#size-=prior.byteLength;}
    const copy=bytes.slice(0);this.#entries.set(id,copy);this.#size+=copy.byteLength;
   }
   return bytes.slice(0);
  }catch(e){if(e instanceof ArcadeAssetError)throw e;fail('Asset fetch failed');}
  finally{signal?.removeEventListener?.('abort',abort);this.#controllers.delete(controller);}
 }
 clear(){this.#entries.clear();this.#size=0;}
 dispose(){if(this.#disposed)return;this.#disposed=true;for(const c of this.#controllers)c.abort();this.#controllers.clear();this.clear();}
}
