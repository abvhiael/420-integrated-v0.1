// BC-1.8 operator-triggered, non-secret Cloudflare Pages production flag
// activation. Fail closed on an unexpected project, secret vars, or changed
// account-social prerequisites. Existing production variables are preserved.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const project='bonggoggles';
if(!token||!account||!/^[a-f0-9]{32}$/.test(account))throw Error('Cloudflare deployment secrets unavailable');
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+project;
async function api(method,body){
 const r=await fetch(endpoint,{method,headers:{Authorization:'Bearer '+token,
 Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const response=await r.json().catch(()=>null);
 if(!r.ok||!response?.success||!response.result)throw Error('Cloudflare Pages project '+method+' failed (HTTP '+r.status+')');
 return response.result;
}
const before=await api('GET');
if(before.name!==project||before.production_branch!=='main')
 throw Error('Refusing to modify unexpected Cloudflare Pages project/branch');
const vars=before.deployment_configs?.production?.env_vars;
if(!vars||typeof vars!=='object'||Array.isArray(vars))
 throw Error('Cannot inspect existing production environment');
for(const v of Object.values(vars)){
 if(v?.type!=='plain_text'||typeof v.value!=='string')
  throw Error('Preserving secret or unsupported production variable requires Cloudflare operator');
}
if(vars.BG_ACCOUNT_SOCIAL_ACTIVATION?.value!=='true')
 throw Error('BongGoggles 420ID Pages activation is not active');
const set={...vars,
 BG_CLASSIC_ROOMS_ACTIVATION:{type:'plain_text',value:'true'},
 BG_CLASSIC_COMMUNICATIONS_ACTIVATION:{type:'plain_text',value:'true'}};
const result=await api('PATCH',{deployment_configs:{production:{env_vars:set}}});
if(result.name!==project)throw Error('Cloudflare Pages PATCH returned wrong project');
const after=await api('GET'),actual=after.deployment_configs?.production?.env_vars;
if(!actual||Object.entries(set).some(([key,v])=>actual[key]?.type!==v.type||actual[key]?.value!==v.value))
 throw Error('Cloudflare Pages production activation not persisted exactly');
console.log('BC-1.8 Pages production activation verified: accountSocial=true, classicRooms=true, classicCommunications=true; other text values preserved');
