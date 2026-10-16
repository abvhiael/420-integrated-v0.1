// R06.3 local integration browser login; short-lived bearer is kept in memory only.
export function createHighCountryLocalAuthClient({baseUrl,fetchImpl=fetch}={}){
 if(typeof baseUrl!=='string'||(!/^https:\/\//.test(baseUrl)&&!/^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/.test(baseUrl)))throw Error('local-auth-url-invalid');
 let token=null;
 async function request(path,body,withToken=false){
  const response=await fetchImpl(new URL(path,baseUrl+'/'),{
   method:'POST',credentials:'omit',mode:'cors',cache:'no-store',
   headers:{'content-type':'application/json',...(withToken&&token?{authorization:'Bearer '+token}:{})},
   body:JSON.stringify(body)
  });
  if(!response.ok)throw Error('authentication-denied');
  const reply=await response.json();
  return reply.result;
 }
 return Object.freeze({
  register:({username,password})=>request('/auth/register',{username,password}),
  login:async({username,password})=>{token=null;const result=await request('/auth/login',{username,password});
   if(typeof result?.token!=='string'||!Number.isSafeInteger(result.expiresAt))throw Error('authentication-response-invalid');
   token=result.token;return {expiresAt:result.expiresAt};},
  getToken:async()=>token,
  logout:async()=>{try{if(token)await request('/auth/logout',{},true);}finally{token=null;}}
 });
}
