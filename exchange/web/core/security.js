const TRUSTED_ORIGINS=Object.freeze(['https://exchange.420integrated.org']);

export function sanitizeSubjectId(value){
  if(value===null||value===undefined||value==='') return null;
  const s=String(value);
  if(s.length>160) throw new Error('subjectId too long');
  if(!/^[A-Za-z0-9:._-]+$/.test(s)) throw new Error('invalid subjectId');
  return s;
}

export function sanitizePathname(pathname){
  const p=String(pathname||'/');
  if(!p.startsWith('/')) return '/';
  if(p.includes('\\')||p.includes('%2f')||p.includes('%5c')) return '/';
  return p;
}

export function trustedOrigin(url){
  try{
    const u=new URL(url);
    return TRUSTED_ORIGINS.includes(u.origin);
  }catch{
    return false;
  }
}

export function assertTrustedExternalUrl(url,{allowWebSocket=false}={}){
  if(url===null||url===undefined) return null;
  const u=new URL(String(url));
  const allowed=allowWebSocket?['https:','wss:']:['https:'];
  if(!allowed.includes(u.protocol)) throw new Error('untrusted protocol');
  if(u.username||u.password) throw new Error('credentials in URL forbidden');
  return u.toString();
}

export function freezeReviewedIntent(intent){
  if(!intent||typeof intent!=='object'||Array.isArray(intent)) throw new Error('invalid intent');
  const clone=JSON.parse(JSON.stringify(intent));
  return deepFreeze(clone);
}

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

export function reviewedIntentDigest(intent){
  const normalized=stable(intent);
  let hash=2166136261;
  for(let i=0;i<normalized.length;i++){
    hash^=normalized.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
}

function stable(value){
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  return '{'+Object.keys(value).sort().map((k)=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}

export function assertReviewedIntentUnchanged(intent,digest){
  if(reviewedIntentDigest(intent)!==digest) throw new Error('reviewed intent changed');
  return true;
}
