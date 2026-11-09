// Server-side adapter for the actual 420Notifications Go BET delivery API.
// The Go service reports pending only until a genuine provider receipt exists.
const requireValid=(ok,why)=>{if(!ok)throw Error('420Notifications Go adapter: '+why);};
const TOKEN=/^[A-Za-z0-9._~+/-]{32,4096}$/;
export function createGo420NotificationsAdapter({origin,serviceToken,fetcher=fetch,timeoutMs=8000}={}){
 const u=new URL(origin);
 requireValid(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
  u.pathname==='/'&&u.hostname,'private HTTPS root required');
 requireValid(typeof serviceToken==='string'&&TOKEN.test(serviceToken),'server-held delivery token required');
 requireValid(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 async function request(route,payload){
  const res=await fetcher(u.origin+'/v1/420bet/deliveries/'+route,{
   method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
   headers:{'Content-Type':'application/json',Accept:'application/json',
    Authorization:'Bearer '+serviceToken},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)
  });
  requireValid(res?.ok,'authenticated Go delivery service unavailable');
  const text=await res.text();
  requireValid(text.length>0&&text.length<=8192,'invalid Go receipt size');
  const value=JSON.parse(text);
  requireValid(value&&typeof value==='object'&&!Array.isArray(value),
   'invalid Go receipt envelope');
  return value;
 }
 return Object.freeze({
  async deliverAuthenticated(req){
   requireValid(req?.event?.schema==='420bet-notification-v1'&&
    typeof req.idempotencyKey==='string','invalid source event');
   return request('send',req);
  },
  async readReceipt(req){return request('receipt',req);},
  async cancelDelivery(req){return request('cancel',req);}
 });
}
