const ID_RE=/^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCOPE_RE=/^[a-z0-9][a-z0-9:._/-]{0,127}$/;
const SHA256_RE=/^[0-9a-f]{64}$/;
const SCHEMA_VERSION='1.0.0';
export class ServiceIdentityError420 extends Error{constructor(message){super(message);this.name='ServiceIdentityError420';}}
function assert420(c,m){if(!c)throw new ServiceIdentityError420(m);}
function object420(v,n){assert420(v&&typeof v==='object'&&!Array.isArray(v),`${n} must be an object`);return v;}
function exact420(v,keys,n){for(const k of Object.keys(v))assert420(keys.has(k),`${n} contains unsupported field: ${k}`);}
function text420(v,n,max=256){assert420(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,`${n} is invalid`);return v.trim();}
function id420(v,n){const s=text420(v,n,64);assert420(ID_RE.test(s),`${n} is invalid`);return s;}
function list420(v,n,{max=32,pattern=SCOPE_RE}={}){assert420(Array.isArray(v)&&v.length>=1&&v.length<=max,`${n} must contain 1 to ${max} entries`);const out=v.map((x,i)=>{const s=text420(x,`${n}[${i}]`,128);assert420(pattern.test(s),`${n}[${i}] is invalid`);return s;});assert420(new Set(out).size===out.length,`${n} must be unique`);return Object.freeze(out);}
function iso420(v,n){const s=text420(v,n,64);const ms=Date.parse(s);assert420(Number.isFinite(ms),`${n} must be an ISO date-time`);return new Date(ms).toISOString();}

export function validateServiceApplicationIdentity420(input){
 const app=object420(input,'service application identity');
 exact420(app,new Set(['schemaVersion','applicationId','chainId','environment','displayName','ownerRef','audiences','allowedScopes','registrationRef']),'service application identity');
 assert420(app.schemaVersion===SCHEMA_VERSION,'unsupported service application identity schemaVersion');
 assert420(typeof app.chainId==='string'&&/^[1-9][0-9]*$/.test(app.chainId),'chainId must be a positive decimal string');
 const audiences=list420(app.audiences,'audiences',{max:16});
 const allowedScopes=list420(app.allowedScopes,'allowedScopes',{max:64});
 const registrationRef=app.registrationRef===undefined||app.registrationRef===null?null:text420(app.registrationRef,'registrationRef',256);
 return Object.freeze({schemaVersion:SCHEMA_VERSION,applicationId:id420(app.applicationId,'applicationId'),chainId:app.chainId,environment:id420(app.environment,'environment'),displayName:text420(app.displayName,'displayName',120),ownerRef:text420(app.ownerRef,'ownerRef',256),audiences,allowedScopes,registrationRef,authority:'off-chain-service-auth',canonicalProtocolAuthority:false,onChainIdentityCredential:false,walletCapability:false,registryLegitimacy:false});
}

export function createApiCredentialIssuancePlan420({network,application,request}){
 const app=validateServiceApplicationIdentity420(application);
 assert420(network&&typeof network.chainIdDecimal==='string','discovered network is required');
 assert420(app.chainId===network.chainIdDecimal,'service application chainId does not match selected network');
 assert420(app.environment===network.environment,'service application environment does not match selected network');
 const req=object420(request,'credential request');
 exact420(req,new Set(['schemaVersion','credentialId','audience','scopes','issuedAt','expiresAt','secretSha256']),'credential request');
 assert420(req.schemaVersion===SCHEMA_VERSION,'unsupported credential request schemaVersion');
 const audience=id420(req.audience,'audience');
 assert420(app.audiences.includes(audience),'credential audience is not allowed for application');
 const scopes=list420(req.scopes,'scopes',{max:32});
 for(const scope of scopes)assert420(app.allowedScopes.includes(scope),`credential scope is not allowed: ${scope}`);
 const issuedAt=iso420(req.issuedAt,'issuedAt'); const expiresAt=iso420(req.expiresAt,'expiresAt');
 assert420(Date.parse(expiresAt)>Date.parse(issuedAt),'expiresAt must be after issuedAt');
 assert420(typeof req.secretSha256==='string'&&SHA256_RE.test(req.secretSha256),'secretSha256 must be a lowercase SHA-256 digest');
 return Object.freeze({schemaVersion:SCHEMA_VERSION,status:'READY_FOR_OFFCHAIN_ISSUANCE',applicationId:app.applicationId,credentialId:id420(req.credentialId,'credentialId'),network:Object.freeze({chainId:network.chainIdDecimal,environment:network.environment}),audience,scopes,issuedAt,expiresAt,secretSha256:req.secretSha256,secretMaterialManaged:false,secretMaterialPersisted:false,credentialAuthority:'off-chain Developer Hub credential service',canonicalProtocolAuthority:false,onChainIdentityCredential:false,walletCapability:false,registryLegitimacy:false,nextAction:'ISSUE_SECRET_IN_OFFCHAIN_CREDENTIAL_SERVICE'});
}

export function createServiceIdentityView420(application){const app=validateServiceApplicationIdentity420(application);return Object.freeze({title:'Off-chain application identity',applicationId:app.applicationId,chainId:app.chainId,environment:app.environment,audiences:app.audiences,allowedScopes:app.allowedScopes,authority:app.authority,canonicalProtocolAuthority:false,onChainIdentityCredential:false,walletCapability:false,registryLegitimacy:false,securityRule:'service credentials authenticate off-chain API requests only; they do not grant 420 Identity, wallet, Registry, governance or protocol authority'});}
