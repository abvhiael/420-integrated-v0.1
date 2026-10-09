import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicPrivateStorage420, ProjectWorkspace420 } from "../src/index.js";

const DAY=24*60*60*1000;
const good=(id="job:1")=>({jobId:id,requestDigest:"req:"+id,state:"SUCCEEDED",outputManifest:{artifacts:[
 {kind:"MIX",storageRef:"provider://mix/"+id,integrity:"sha256:mix-"+id,label:"mix"},
 {kind:"STEM",storageRef:"provider://stem/"+id,integrity:"sha256:stem-"+id,label:"vocals"},
 {kind:"LYRICS_TIMING",storageRef:"provider://lyrics/"+id,integrity:"sha256:lyrics-"+id,label:"lyrics"},
 {kind:"ARTWORK",storageRef:"provider://art/"+id,integrity:"sha256:art-"+id,label:"art"}]}});
const bad=(id="job:bad")=>({jobId:id,requestDigest:"req:"+id,state:"FAILED",outputManifest:null,lastError:{code:"PROVIDER_REJECTED"}});

test("projects are private and never public-indexed",()=>{
 const ws=new ProjectWorkspace420({now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a",lyricsDraft:"draft"});
 assert.equal(p.visibility,"PRIVATE");assert.equal(p.indexable,false);assert.deepEqual(ws.publicIndexRecords(),[]);
 assert.throws(()=>ws.getProject(p.projectId,"wallet:b"),/project unavailable/);
});

test("project history is a parent-linked version tree",()=>{
 let now=1000;const ws=new ProjectWorkspace420({now:()=>now}),p=ws.createProject({ownerRef:"wallet:a",lyricsDraft:"v1"});
 now=1100;ws.updateDraft(p.projectId,"wallet:a",{lyricsDraft:"v2"});now=1200;ws.updateDraft(p.projectId,"wallet:a",{lyricsDraft:"v3"});
 const got=ws.getProject(p.projectId,"wallet:a");assert.equal(got.versions.length,3);
 assert.equal(got.versions[1].parentVersionId,got.versions[0].versionId);assert.equal(got.versions[2].parentVersionId,got.versions[1].versionId);
});

test("complete take stores artifact manifest and verifies integrity",()=>{
 const ws=new ProjectWorkspace420({now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a"});
 const t=ws.recordGeneration(p.projectId,"wallet:a",good(),{saveArtifacts:true});
 assert.equal(t.status,"COMPLETE");assert.equal(t.artifacts.length,4);assert.equal(ws.verifyArtifacts(p.projectId,"wallet:a",t.takeId).every(x=>x.verified),true);
 assert.equal(ws.usage("wallet:a").objectCount,4);
});

test("favorite and selected take require complete outputs",()=>{
 const ws=new ProjectWorkspace420({now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a"});
 const a=ws.recordGeneration(p.projectId,"wallet:a",good()),b=ws.recordGeneration(p.projectId,"wallet:a",bad());
 assert.equal(ws.favoriteTake(p.projectId,"wallet:a",a.takeId,true).favorite,true);assert.equal(ws.selectTake(p.projectId,"wallet:a",a.takeId).selected,true);
 assert.throws(()=>ws.favoriteTake(p.projectId,"wallet:a",b.takeId,true),/only complete/);assert.throws(()=>ws.selectTake(p.projectId,"wallet:a",b.takeId),/must be complete/);
});

test("failed and incomplete output sets never become selectable artifacts",()=>{
 const ws=new ProjectWorkspace420({now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a"});
 const f=ws.recordGeneration(p.projectId,"wallet:a",bad()),i=ws.recordGeneration(p.projectId,"wallet:a",{jobId:"run",requestDigest:"r",state:"RUNNING",outputManifest:{artifacts:[{kind:"MIX",storageRef:"x",integrity:"y"}]}});
 assert.equal(f.artifacts.length,0);assert.equal(i.status,"INCOMPLETE");assert.equal(i.artifacts.length,0);assert.equal(ws.getProject(p.projectId,"wallet:a").selectedTakeId,null);
});

test("quota exhaustion fails closed without deleting prior work",()=>{
 const ws=new ProjectWorkspace420({now:()=>1000,accountQuotaBytes:200,projectQuotaBytes:200}),p=ws.createProject({ownerRef:"wallet:a"});
 assert.throws(()=>ws.recordGeneration(p.projectId,"wallet:a",good()),e=>e.code==="NO_CAPACITY");
 assert.equal(ws.getProject(p.projectId,"wallet:a").takes.length,0);
});

test("archive is private and bounded",()=>{
 let now=1000;const ws=new ProjectWorkspace420({now:()=>now}),p=ws.createProject({ownerRef:"wallet:a"});
 ws.recordGeneration(p.projectId,"wallet:a",good());const a=ws.archive(p.projectId,"wallet:a");
 assert.equal(a.status,"ARCHIVED");assert.equal(a.visibility,"PRIVATE");now+=10*DAY;assert.equal(ws.restore(p.projectId,"wallet:a").status,"ACTIVE");
});

test("archive expiry deletes and tombstones stored artifacts",()=>{
 let now=1000;const storage=new DeterministicPrivateStorage420(),ws=new ProjectWorkspace420({storage,now:()=>now}),p=ws.createProject({ownerRef:"wallet:a"});
 const t=ws.recordGeneration(p.projectId,"wallet:a",good()),ref=t.artifacts[0].storageRef;ws.archive(p.projectId,"wallet:a");now+=31*DAY;
 assert.ok(ws.sweepRetention().some(x=>x.action==="ARCHIVE_EXPIRED_DELETE"));assert.equal(storage.has(ref),false);assert.throws(()=>storage.get(ref),/deleted/);
});

test("export is access-controlled and expires in 24 hours",()=>{
 let now=1000;const ws=new ProjectWorkspace420({now:()=>now}),p=ws.createProject({ownerRef:"wallet:a"});ws.recordGeneration(p.projectId,"wallet:a",good());
 const e=ws.exportProject(p.projectId,"wallet:a");assert.equal(e.expiresAt-e.createdAt,DAY);assert.equal(ws.readExport(e.exportId,"wallet:a").secretsIncluded,false);
 assert.throws(()=>ws.readExport(e.exportId,"wallet:b"),/unavailable/);now=e.expiresAt+1;assert.throws(()=>ws.readExport(e.exportId,"wallet:a"),/expired/);
});

test("delete revokes serving/indexing and blocks resurrection",()=>{
 const storage=new DeterministicPrivateStorage420(),ws=new ProjectWorkspace420({storage,now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a"});
 const t=ws.recordGeneration(p.projectId,"wallet:a",good()),ref=t.artifacts[0].storageRef,d=ws.deleteProject(p.projectId,"wallet:a");
 assert.equal(d.servingRevoked,true);assert.equal(d.indexingRevoked,true);assert.throws(()=>storage.get(ref),/deleted/);assert.deepEqual(ws.publicIndexRecords(),[]);
});

test("storage integrity tampering fails closed",()=>{
 const storage=new DeterministicPrivateStorage420(),ws=new ProjectWorkspace420({storage,now:()=>1000}),p=ws.createProject({ownerRef:"wallet:a"});
 const t=ws.recordGeneration(p.projectId,"wallet:a",good()),ref=t.artifacts[0].storageRef;storage.objects.get(ref).body=Buffer.from("tampered");
 assert.throws(()=>ws.verifyArtifacts(p.projectId,"wallet:a",t.takeId),e=>e.code==="INTEGRITY_MISMATCH");
});

test("failed take retention is seven days",()=>{
 let now=1000;const ws=new ProjectWorkspace420({now:()=>now}),p=ws.createProject({ownerRef:"wallet:a"}),t=ws.recordGeneration(p.projectId,"wallet:a",bad());
 assert.equal(t.retentionExpiresAt,1000+7*DAY);now=t.retentionExpiresAt+1;assert.ok(ws.sweepRetention().some(x=>x.takeId===t.takeId));assert.equal(ws.getProject(p.projectId,"wallet:a").takes.length,0);
});

test("365-day inactivity archives without changing privacy",()=>{
 let now=1000;const ws=new ProjectWorkspace420({now:()=>now}),p=ws.createProject({ownerRef:"wallet:a"});now+=366*DAY;ws.sweepRetention();
 const a=ws.getProject(p.projectId,"wallet:a");assert.equal(a.status,"ARCHIVED");assert.equal(a.visibility,"PRIVATE");assert.equal(a.indexable,false);
});

test("storage idempotency tombstone prevents replay resurrection",()=>{
 const s=new DeterministicPrivateStorage420(),a={accountRef:"a",projectId:"p",kind:"MIX",label:"x",content:"one",idempotencyKey:"idem"};
 const x=s.put(a);assert.equal(s.put(a).storageRef,x.storageRef);s.delete(x.storageRef);assert.throws(()=>s.put(a),e=>e.code==="REPLAY_CONFLICT");
});
