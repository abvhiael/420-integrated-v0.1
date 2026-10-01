const DEFAULT_HEADERS=Object.freeze({
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'cross-origin-resource-policy':'same-site',
});
const CREDENTIAL_HEADERS=Object.freeze(['authorization','cookie','proxy-authorization','x-api-key']);

export class HttpSecurityError extends Error{
  constructor(code,message,status=403){super(message);this.name='HttpSecurityError';this.code=code;this.status=status;}
}
export function normalizeAllowedOrigins(origins=[]){
  if(!Array.isArray(origins))throw new TypeError('allowedOrigins must be an array');
  return Object.freeze(origins.map(value=>{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new TypeError('allowed origin must be an HTTPS origin');
    return u.origin;
  }).filter((v,i,a)=>a.indexOf(v)===i));
}
export function inspectRequestSecurity(req,{allowedOrigins=[],allowCredentials=false,maxTargetBytes=4096}={}){
  const origins=normalizeAllowedOrigins(allowedOrigins);
  const target=String(req.url??'');
  if(Buffer.byteLength(target)>maxTargetBytes)throw new HttpSecurityError('REQUEST_TARGET_TOO_LARGE','request target exceeds size limit',414);
  const origin=req.headers?.origin?String(req.headers.origin):null;
  if(origin!==null&&!origins.includes(origin))throw new HttpSecurityError('ORIGIN_FORBIDDEN','request origin is not allowed',403);
  if(!allowCredentials){
    for(const name of CREDENTIAL_HEADERS)if(req.headers?.[name])throw new HttpSecurityError('CREDENTIALS_FORBIDDEN','credential-bearing requests are not accepted',403);
  }
  return Object.freeze({origin,allowedOrigins:origins});
}
export function responseSecurityHeaders({origin=null,allowedMethods='GET, POST, OPTIONS'}={}){
  return Object.freeze({
    ...DEFAULT_HEADERS,
    ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{}),
    'access-control-allow-methods':allowedMethods,
    'access-control-allow-headers':'content-type, x-request-id',
  });
}
export function preflight(req,res,policy={}){
  if(req.method!=='OPTIONS')return false;
  const checked=inspectRequestSecurity(req,policy);
  res.writeHead(204,responseSecurityHeaders({origin:checked.origin,allowedMethods:policy.allowedMethods??'GET, POST, OPTIONS'}));
  res.end();
  return true;
}
