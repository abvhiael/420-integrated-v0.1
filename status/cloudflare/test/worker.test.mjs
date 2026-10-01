import test from "node:test";
import assert from "node:assert/strict";
import worker,{validOrigin} from "../src/worker.mjs";

test("validOrigin accepts public https and rejects unsafe origins",()=>{
  assert.equal(validOrigin("https://status-api.example.org"),true);
  assert.equal(validOrigin("http://status-api.example.org"),false);
  assert.equal(validOrigin("https://localhost:8422"),false);
  assert.equal(validOrigin("https://127.0.0.1:8422"),false);
  assert.equal(validOrigin("notaurl"),false);
});

test("API fails closed when origin is absent",async()=>{
  const req=new Request("https://status.420integrated.org/v1/status");
  const res=await worker.fetch(req,{ASSETS:{fetch:()=>new Response("asset")}});
  assert.equal(res.status,503);
  const body=await res.json();
  assert.equal(body.canonical,false);
  assert.equal(body.error,"ORIGIN_NOT_CONFIGURED");
  assert.equal(res.headers.get("x-content-type-options"),"nosniff");
});

test("static assets remain available without backend origin",async()=>{
  const req=new Request("https://status.420integrated.org/");
  const res=await worker.fetch(req,{ASSETS:{fetch:()=>new Response("<h1>420Status</h1>",{headers:{"content-type":"text/html"}})}});
  assert.equal(res.status,200);
  assert.match(await res.text(),/420Status/);
  assert.equal(res.headers.get("referrer-policy"),"no-referrer");
});

test("mutating methods are rejected",async()=>{
  const req=new Request("https://status.420integrated.org/v1/status",{method:"POST"});
  const res=await worker.fetch(req,{ASSETS:{fetch:()=>new Response("asset")}});
  assert.equal(res.status,405);
});
