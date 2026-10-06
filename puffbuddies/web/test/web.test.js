import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {ClientState} from "../state.js";
import {createApiClient,ApiError} from "../api-client.js";

const root=path.resolve(import.meta.dirname,"..");

test("authority generation invalidates all derived client state",()=>{
  const s=new ClientState();
  s.discovery=[1];s.matches=[2];s.notifications=[3];s.premium=[4];
  s.applyAuthorityGeneration(7);
  assert.equal(s.authorityGeneration,7);
  assert.deepEqual(s.discovery,[]);assert.deepEqual(s.matches,[]);
  assert.deepEqual(s.notifications,[]);assert.deepEqual(s.premium,[]);
});

test("stale authority generation fails closed",()=>{
  const s=new ClientState();s.applyAuthorityGeneration(5);
  assert.throws(()=>s.applyAuthorityGeneration(4),/stale authority generation/);
});

test("sign out clears token and derived state",()=>{
  const s=new ClientState();s.setSessionToken("secret");s.authorityGeneration=2;s.discovery=[1];
  s.clearSession();
  assert.equal(s.sessionToken,"");assert.equal(s.authorityGeneration,0);assert.deepEqual(s.discovery,[]);
});

test("API client is same-origin, no-store, memory-token and fail-closed",async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>({authorityGeneration:1,state:"ELIGIBLE"})}};
  const api=createApiClient({apiBase:"/api/puffbuddies/v1",tokenProvider:()=>"memory-token",fetchImpl});
  await api.eligibility();
  assert.equal(calls[0].url,"/api/puffbuddies/v1/eligibility");
  assert.equal(calls[0].opts.cache,"no-store");
  assert.equal(calls[0].opts.credentials,"same-origin");
  assert.equal(calls[0].opts.headers.Authorization,"Bearer memory-token");
  assert.throws(()=>createApiClient({apiBase:"https://example.com",fetchImpl}),/same-origin/);
});

test("API denial does not become successful client authority",async()=>{
  const api=createApiClient({apiBase:"/api/puffbuddies/v1",tokenProvider:()=>"",
    fetchImpl:async()=>({ok:false,status:403,json:async()=>({})})});
  await assert.rejects(()=>api.matches(),e=>e instanceof ApiError && e.status===403);
});

test("core web MVP and baseline safety controls are always present",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  for(const id of ["entry","profile","discovery","matches","notifications","safety","settings"]){
    assert.match(html,new RegExp(`id="${id}"`));
  }
  for(const control of ["Block","Report","Unmatch","Deactivate","Request deletion"]){
    assert.ok(html.includes(control),control);
  }
  assert.ok(!/premium[^\n]{0,120}(block|report|unmatch|delete)/i.test(html));
});

test("web surface includes basic accessibility and responsive requirements",()=>{
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
  assert.ok(html.includes('href="#main"'));
  assert.ok(html.includes('aria-live="assertive"'));
  assert.ok(html.includes('aria-label="PuffBuddies sections"'));
  assert.ok(html.includes('<meta name="viewport"'));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("@media"));
});

test("runtime configuration never claims live deployment",()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(root,"runtime-config.json"),"utf8"));
  assert.equal(cfg.deploymentStatus,"repository-qualified-not-deployed");
  assert.equal(cfg.authorityMode,"server-revalidated");
  assert.equal(cfg.cacheMode,"memory-only");
});

test("browser source contains no persistent-authority storage primitive",()=>{
  const source=["app.js","api-client.js","state.js"].map(x=>fs.readFileSync(path.join(root,x),"utf8")).join("\n");
  for(const x of ["localStorage","sessionStorage","indexedDB","document.cookie"]) assert.ok(!source.includes(x),x);
});

test("API action surface delegates protected decisions to server endpoints",()=>{
  const source=fs.readFileSync(path.join(root,"api-client.js"),"utf8");
  for(const route of ["/eligibility","/profile","/discovery","/relationships/action","/matches",
    "/messenger/entry","/notifications","/safety/action","/profile/visibility","/lifecycle",
    "/deletion/status","/verification","/premium/entitlements"]) assert.ok(source.includes(route),route);
});
