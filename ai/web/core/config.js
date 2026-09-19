const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const secure=(value)=>{if(value===null)return true; const u=new URL(value); return u.protocol==='https:'||(['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&u.protocol==='http:');};
export function validateRuntimeConfig(c){
  if(!c||c.schemaVersion!=='420-ai-web-v1') throw new Error('unsupported AI web config');
  if(c.network?.chainId!==null&&!/^[1-9][0-9]*$/.test(String(c.network.chainId))) throw new Error('invalid chainId');
  for(const [k,v] of Object.entries(c.services||{})) if(!secure(v)) throw new Error(`insecure service endpoint: ${k}`);
  for(const [k,v] of Object.entries(c.contracts||{})) if(!ADDRESS.test(v)) throw new Error(`invalid contract address: ${k}`);
  if(c.features?.writes!==false) throw new Error('AI web writes must remain fail-closed until wallet transaction adapter qualifies');
  return structuredClone(c);
}
