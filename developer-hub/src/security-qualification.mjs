const ID_RE=/^[a-z0-9][a-z0-9._-]{0,127}$/;
const STATUS=new Set(['PASS','FAIL','BLOCKED','NOT_APPLICABLE']);
const ENV=new Set(['local','devnet','testnet','mainnet']);
const SECRET_FIELDS=new Set(['privatekey','mnemonic','seedphrase','bearertoken','apisecret','password','rawsecret','signingkey']);

export class SecurityQualificationError420 extends Error{constructor(message){super(message);this.name='SecurityQualificationError420';}}
function assert420(condition,message){if(!condition)throw new SecurityQualificationError420(message);}
function plain420(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function iso420(value,name){assert420(typeof value==='string'&&!Number.isNaN(Date.parse(value)),`${name} must be an ISO timestamp`);return new Date(value).toISOString();}
function id420(value,name){assert420(typeof value==='string'&&ID_RE.test(value),`${name} is invalid`);return value;}
function secretScan420(value,path='$'){
  if(Array.isArray(value)){value.forEach((item,i)=>secretScan420(item,`${path}[${i}]`));return;}
  if(!plain420(value))return;
  for(const [key,item] of Object.entries(value)){
    const normalized=key.replace(/[^a-z0-9]/gi,'').toLowerCase();
    assert420(!SECRET_FIELDS.has(normalized),`raw secret-shaped field is forbidden at ${path}.${key}`);
    secretScan420(item,`${path}.${key}`);
  }
}
export function validateSecurityQualificationProfile420(profile){
  assert420(plain420(profile),'qualification profile is required');
  assert420(profile.schemaVersion==='1.0.0','unsupported qualification profile schemaVersion');
  id420(profile.profileId,'profileId');
  assert420(profile.canonicalAuthority===false,'qualification profile must declare canonicalAuthority false');
  assert420(profile.securityCertification===false,'qualification profile must declare securityCertification false');
  assert420(Array.isArray(profile.checks)&&profile.checks.length>0,'qualification profile requires checks');
  const seen=new Set();
  for(const check of profile.checks){
    assert420(plain420(check),'qualification check is invalid');
    id420(check.id,'check id');
    assert420(!seen.has(check.id),`duplicate qualification check: ${check.id}`);seen.add(check.id);
    assert420(typeof check.category==='string'&&check.category.length>0,'check category is required');
    assert420(typeof check.required==='boolean','check required must be boolean');
    if(check.environments!==undefined){assert420(Array.isArray(check.environments)&&check.environments.length>0,'check environments are invalid');for(const environment of check.environments)assert420(ENV.has(environment),`unsupported check environment: ${environment}`);}
  }
  return profile;
}
function applicable420(check,environment){return !check.environments||check.environments.includes(environment);}
export function createSecurityQualificationReport420({profile,evidence,network}){
  validateSecurityQualificationProfile420(profile);secretScan420(evidence);
  assert420(plain420(evidence),'qualification evidence is required');
  assert420(evidence.schemaVersion==='1.0.0','unsupported qualification evidence schemaVersion');
  assert420(evidence.profileId===profile.profileId,'qualification evidence profileId mismatch');
  id420(evidence.projectId,'projectId');
  assert420(plain420(evidence.network),'qualification evidence network is required');
  assert420(typeof evidence.network.chainId==='string'&&/^[1-9][0-9]*$/.test(evidence.network.chainId),'evidence chainId is invalid');
  assert420(ENV.has(evidence.network.environment),'evidence environment is invalid');
  assert420(network&&typeof network.chainIdDecimal==='string','discovered network is required');
  assert420(evidence.network.chainId===network.chainIdDecimal,'qualification evidence chainId does not match selected network');
  assert420(evidence.network.environment===network.environment,'qualification evidence environment does not match selected network');
  const observedAt=iso420(evidence.observedAt,'observedAt');
  assert420(Array.isArray(evidence.checks),'qualification evidence checks are required');
  const supplied=new Map();
  for(const item of evidence.checks){
    assert420(plain420(item),'qualification evidence check is invalid');
    id420(item.id,'evidence check id');assert420(!supplied.has(item.id),`duplicate evidence check: ${item.id}`);
    assert420(STATUS.has(item.status),`unsupported qualification status for ${item.id}`);
    assert420(typeof item.source==='string'&&item.source.length>0&&item.source.length<=512,`evidence source is invalid for ${item.id}`);
    supplied.set(item.id,item);
  }
  for(const id of supplied.keys())assert420(profile.checks.some(check=>check.id===id),`unknown qualification check: ${id}`);
  const checks=profile.checks.map(check=>{
    const applies=applicable420(check,evidence.network.environment);
    const item=supplied.get(check.id);
    if(!applies)return Object.freeze({id:check.id,category:check.category,required:check.required,applicable:false,status:'NOT_APPLICABLE',source:null});
    if(!item)return Object.freeze({id:check.id,category:check.category,required:check.required,applicable:true,status:'BLOCKED',source:null,reason:'missing evidence'});
    assert420(item.status!=='NOT_APPLICABLE'||!check.required,`required applicable check cannot be NOT_APPLICABLE: ${check.id}`);
    return Object.freeze({id:check.id,category:check.category,required:check.required,applicable:true,status:item.status,source:item.source,evidence:item.evidence??null});
  });
  const required=checks.filter(check=>check.required&&check.applicable);
  const overall=required.some(check=>check.status==='FAIL')?'FAIL':required.some(check=>check.status!=='PASS')?'BLOCKED':'PASS';
  return Object.freeze({
    schemaVersion:'1.0.0',profileId:profile.profileId,projectId:evidence.projectId,
    network:Object.freeze({chainId:evidence.network.chainId,environment:evidence.network.environment}),observedAt,
    result:overall,qualifiedForDeveloperRelease:overall==='PASS',canonicalAuthority:false,securityCertification:false,
    checks:Object.freeze(checks),
    securityRule:'qualification evidence gates developer release only; PASS is not a security audit, protocol authorization, Registry legitimacy, Wallet capability, governance approval, or canonical state'
  });
}
export function createSecurityQualificationView420(profile){
  validateSecurityQualificationProfile420(profile);
  return Object.freeze({title:'security & developer qualification',profileId:profile.profileId,canonicalAuthority:false,securityCertification:false,requiredChecks:Object.freeze(profile.checks.filter(c=>c.required).map(c=>c.id)),securityRule:'qualification reports are evidence-driven release gates and never confer protocol authority'});
}
