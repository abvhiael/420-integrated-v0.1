import test from "node:test";
import assert from "node:assert/strict";
import {endpoint,validateSession,validatePage,fetchPrivate} from "../workspace.js";
const base={enabled:true,privateApiBaseUrl:"https://private.example/"};
const session=()=>({version:"grow-private-v1",authenticated:true,tenantId:"tenant-a",subjectId:"member-a",sections:["overview","plants","harvests"],actions:["plants.create","plants.transition"],csrf:"a".repeat(64),expiresAt:new Date(Date.now()+60000).toISOString()});
test("private endpoint is fail closed and never inherits public directory configuration",()=>{
 assert.equal(endpoint({}, "https://grow.example"),null);
 assert.equal(endpoint({enabled:false,privateApiBaseUrl:"https://grow.example/"},"https://grow.example"),null);
 assert.equal(endpoint({...base,privateApiBaseUrl:"http://grow.example/"},"https://grow.example"),null);
 assert.equal(endpoint({...base,privateApiBaseUrl:"https://user:pass@grow.example/"},"https://grow.example"),null);
 assert.equal(endpoint({...base,privateApiBaseUrl:"https://grow.example/secret"},"https://grow.example"),null);
 assert.equal(endpoint(base,"https://grow.example"),null);
 assert.equal(endpoint({...base,crossOriginApproved:true},"https://grow.example"),"https://private.example");
});
test("expired, anonymous, malformed, or duplicate-scope sessions denied",()=>{
 const s=session();
 assert.equal(validateSession(s).tenantId,"tenant-a");
 for(const malformed of [{...s,authenticated:false},{...s,expiresAt:"2000-01-01T00:00:00Z"},{...s,sections:["overview","overview"]},{...s,sections:["device-control"]},{...s,subjectId:""},{...s,csrf:"bad"},{...s,actions:["inventory.adjust","plants.create"]}]){
  assert.throws(()=>validateSession(malformed),/Session unavailable/);
 }
});
test("server-projected scoped items reject cross-tenant records and unsafe shapes",()=>{
 const active=validateSession(session());
 const good={version:"grow-private-v1",section:"plants",tenantId:"tenant-a",items:[{id:"plant1",title:"Plant 1",summary:"Observed lifecycle only",tenantId:"tenant-a"}]};
 assert.equal(validatePage(good,"plants",active)[0].title,"Plant 1");
 assert.throws(()=>validatePage(good,"inventory",active));
 assert.throws(()=>validatePage({...good,tenantId:"tenant-b"},"plants",active));
 assert.throws(()=>validatePage({...good,items:[{...good.items[0],tenantId:"tenant-b"}]},"plants",active));
 assert.throws(()=>validatePage({...good,items:[good.items[0],good.items[0]]},"plants",active));
 assert.throws(()=>validatePage({...good,items:Array.from({length:501},(_,i)=>({...good.items[0],id:String(i)}))},"plants",active));
});
test("private session fetch is credentialed but never follows redirects or caches",async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  return{ok:true,headers:{get:()=> "application/json"},text:async()=>JSON.stringify(session())};
 };
 const value=await fetchPrivate({...base,crossOriginApproved:true},"https://grow.example",fetcher);
 assert.equal(value.session.tenantId,"tenant-a");
 assert.equal(calls[0].url,"https://private.example/v1/private/session");
 assert.equal(calls[0].opts.credentials,"include");
 assert.equal(calls[0].opts.redirect,"error");
 assert.equal(calls[0].opts.cache,"no-store");
});
test("private client fails closed when source is unconfigured or server response is untrusted",async()=>{
 await assert.rejects(fetchPrivate({enabled:false},"https://grow.example",()=>{throw Error("fetch used")}));
 await assert.rejects(fetchPrivate({...base,crossOriginApproved:true},"https://grow.example",async()=>({ok:false,headers:{get:()=> "text/html"}})));
});

test("authorized POST requests are CSRF bound and never cached or redirected",async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,opts});
  if(url.endsWith("/v1/private/session"))
   return {ok:true,headers:{get:()=> "application/json"},text:async()=>JSON.stringify(session())};
  return {ok:true,status:204,headers:{get:()=>null}};
 };
 const api=await fetchPrivate({...base,crossOriginApproved:true},"https://grow.example",fetcher);
 assert.deepEqual(api.session.actions,["plants.create","plants.transition"]);
 const out=await api.post("/v1/private/action/plants",{operation:"create",label:"test"});
 assert.equal(out.success,true);
 assert.equal(calls[1].opts.method,"POST");
 assert.equal(calls[1].opts.headers["X-CSRF-Token"],"a".repeat(64));
 assert.equal(calls[1].opts.credentials,"include");
 assert.equal(calls[1].opts.redirect,"error");
 assert.equal(calls[1].opts.cache,"no-store");
 await api.logout();
 assert.equal(calls[2].url,"https://private.example/v1/private/logout");
 assert.equal(calls[2].opts.headers["X-CSRF-Token"],"a".repeat(64));
});
test("failed mutations never report success",async()=>{
 const fetcher=async(url)=>{
  if(url.endsWith("/v1/private/session"))
   return {ok:true,headers:{get:()=> "application/json"},text:async()=>JSON.stringify(session())};
  return {ok:false,status:403,headers:{get:()=> "application/json"},text:async()=> "denied"};
 };
 const api=await fetchPrivate({...base,crossOriginApproved:true},"https://grow.example",fetcher);
 await assert.rejects(api.post("/v1/private/action/plants",{operation:"create"}),/denied/);
});
