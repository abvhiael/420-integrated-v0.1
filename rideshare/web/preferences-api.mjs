// Transport-only adapter. Identity/session proof is independently issued; backend verifies every request.
export function createRiderPreferencesApi(sessionProvider, {fetchImpl=fetch, origin=globalThis.location?.origin}={}) {
  if(!sessionProvider || typeof sessionProvider.getAccessToken!=='function' || typeof fetchImpl!=='function' || !origin) return null;
  async function send({accountId},method,body) {
    if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))throw Error('Invalid account');
    const proof=await sessionProvider.getAccessToken();
    if(typeof proof!=='string'||proof.length>32768||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(proof))throw Error('Session unavailable');
    const url=new URL('/v1/rideshare/riders/'+encodeURIComponent(accountId)+'/preferences',origin);
    if(url.origin!==origin)throw Error('Origin mismatch');
    const response=await fetchImpl(url,{method,credentials:'omit',cache:'no-store',redirect:'error',headers:{
      'authorization':'Bearer '+proof,
      ...(body===undefined?{}:{'content-type':'application/json'})
    },...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok)throw Error('Preference service rejected '+response.status);
    return response.json();
  }
  return Object.freeze({
    getPreferences:({accountId})=>send({accountId},'GET'),
    savePreferences:({accountId,expectedRevision,preferences})=>send({accountId},'PUT',{expectedRevision,preferences}),
    erasePreferences:({accountId})=>send({accountId},'DELETE')
  });
}
