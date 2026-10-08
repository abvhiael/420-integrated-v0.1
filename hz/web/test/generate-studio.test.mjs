import test from "node:test";
import assert from "node:assert/strict";
import { GenerateStudioModel420 } from "../generate-studio.mjs";

const request={
  prompt:"slow distorted grunge song about a motel at dawn",
  lyrics:"hallway hum / radio lies",
  mode:"VOCAL",
  durationSec:180,
  genres:["grunge"],
  styles:["lo-fi"],
  moods:["melancholy"],
  instrumentation:["guitar","bass","drums"]
};

test("studio starts fail-closed and becomes READY only after a valid request",()=>{
  const m=new GenerateStudioModel420();
  assert.equal(m.snapshot().state,"LANDING");
  m.start();
  assert.equal(m.snapshot().state,"COMPOSING");
  m.updateRequest({...request,prompt:"x"});
  assert.equal(m.snapshot().state,"COMPOSING");
  m.updateRequest(request);
  assert.equal(m.snapshot().state,"READY");
  assert.equal(m.canGenerate(),true);
});

test("quote is an explicitly non-authoritative development capacity projection",()=>{
  const m=new GenerateStudioModel420();
  const q=m.quote();
  assert.equal(q.authoritative,false);
  assert.equal(q.providerId,"mock:420hz");
  assert.equal(q.modelId,"mock:music");
  assert.ok(q.availableSlots>0);
});

test("generation progress produces two comparable complete development takes",()=>{
  let now=1000;
  const m=new GenerateStudioModel420({now:()=>now});
  m.start();m.updateRequest(request);m.begin();
  assert.equal(m.snapshot().state,"GENERATING");
  while(m.snapshot().state==="GENERATING")m.advance();
  const s=m.snapshot();
  assert.equal(s.state,"COMPARE");
  assert.equal(s.takes.length,2);
  assert.deepEqual(s.takes.map(x=>x.variant),["A","B"]);
  assert.equal(s.takes.every(x=>x.status==="COMPLETE"),true);
  assert.equal(s.takes.every(x=>x.artifacts.some(a=>a.kind==="MIX"&&a.available)),true);
  assert.equal(s.takes.every(x=>x.provenance.public===false),true);
});

test("instrumental mode removes lyric-dependent preview artifacts",()=>{
  const m=new GenerateStudioModel420({now:()=>1000});
  m.start();m.updateRequest({...request,mode:"INSTRUMENTAL",lyrics:"must be removed"});
  assert.equal(m.snapshot().request.lyrics,"");
  m.begin();while(m.snapshot().state==="GENERATING")m.advance();
  const t=m.snapshot().takes[0];
  assert.equal(t.artifacts.find(a=>a.kind==="STEM"&&a.label==="vocals").available,false);
  assert.equal(t.artifacts.find(a=>a.kind==="LYRICS_TIMING").available,false);
});

test("A/B selection, save, regenerate and remix controls retain explicit state",()=>{
  const m=new GenerateStudioModel420({now:()=>1000});
  m.start();m.updateRequest(request);m.begin();while(m.snapshot().state==="GENERATING")m.advance();
  const second=m.snapshot().takes[1].takeId;
  m.selectTake(second);
  assert.equal(m.snapshot().selectedTakeId,second);
  m.saveSelected();
  assert.equal(m.snapshot().state,"SAVED");
  assert.deepEqual(m.snapshot().savedTakeIds,[second]);
  assert.equal(m.snapshot().registerPublishReady,true);
  m.remix();
  assert.equal(m.snapshot().state,"READY");
  assert.match(m.snapshot().request.prompt,/^Remix B:/);
  assert.equal(m.snapshot().registerPublishReady,false);
});

test("Register & Publish is only an explicit handoff and never a transaction",()=>{
  const m=new GenerateStudioModel420({now:()=>1000});
  m.start();m.updateRequest(request);m.begin();while(m.snapshot().state==="GENERATING")m.advance();
  assert.throws(()=>m.registerPublishHandoff(),/save a complete take/);
  m.saveSelected();
  const h=m.registerPublishHandoff();
  assert.equal(h.action,"REGISTER_AND_PUBLISH_HANDOFF");
  assert.equal(h.enabled,false);
  assert.match(h.reason,/HZ-GCA-7 owns registration\/publication/);
});

test("provider failure exposes retryable failure and non-fabricated refund state",()=>{
  const m=new GenerateStudioModel420({now:()=>1000});
  m.start();m.updateRequest(request);m.begin({forceFailure:true});
  while(m.snapshot().state==="GENERATING")m.advance();
  const failed=m.snapshot();
  assert.equal(failed.state,"FAILED");
  assert.equal(failed.lastError.code,"PROVIDER_UNAVAILABLE");
  assert.equal(failed.lastError.retryable,true);
  assert.equal(failed.refundState,"NO_SETTLEMENT_OBSERVED");
  m.retry();
  while(m.snapshot().state==="GENERATING")m.advance();
  assert.equal(m.snapshot().state,"COMPARE");
});

test("cancelled generation never fabricates refund or output success",()=>{
  const m=new GenerateStudioModel420();
  m.start();m.updateRequest(request);m.begin();m.cancel();
  const s=m.snapshot();
  assert.equal(s.state,"CANCELLED");
  assert.equal(s.takes.length,0);
  assert.equal(s.refundState,"NO_SETTLEMENT_OBSERVED");
  assert.equal(s.lastError.code,"CANCELLED");
});

test("no capacity prevents generation readiness",()=>{
  const m=new GenerateStudioModel420({capacity:{
    providerId:"mock:420hz",modelId:"mock:music",modelVersion:"1.0.0",
    availableSlots:0,queueDepth:4,estimatedStartMs:120000,asset:"$420",price:"0.42"
  }});
  m.start();m.updateRequest(request);
  assert.equal(m.snapshot().state,"COMPOSING");
  assert.equal(m.canGenerate(),false);
});

test("studio snapshot never represents registration, publication or settlement as complete",()=>{
  const m=new GenerateStudioModel420({now:()=>1000});
  m.start();m.updateRequest(request);m.begin();while(m.snapshot().state==="GENERATING")m.advance();m.saveSelected();
  const encoded=JSON.stringify(m.snapshot());
  assert.equal(encoded.includes('"published":true'),false);
  assert.equal(encoded.includes('"registered":true'),false);
  assert.equal(encoded.includes('"settled":true'),false);
});
