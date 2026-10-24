import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),"utf8");
const d=JSON.parse(read("docs/migration/MIG-0.4-madbuds-reconciliation.json"));
assert.equal(d.step,"MIG-0.4");
assert.equal(d.decision.primaryTargetRuntime,"Godot");
assert.equal(d.decision.legacyRuntime,"Unity");
assert.equal(d.decision.automaticDeletion,false);
assert.equal(d.decision.gameplayWalletOptional,true);
assert.equal(d.canon.characters.length,10);
assert.equal(new Set(d.canon.characters).size,10);
for(const s of d.sources.filter(s=>s.repository==="abvhiael/420-integrated-v0.1"))assert(existsSync(new URL(s.path,root)),"Missing source "+s.path);
const animation=read("assets/arcade/mad-buds/kush-krusher/animations/kk_anim_04_compression_launch/kush_krusher_anim_04_compression_launch.json");
const a=JSON.parse(animation);assert.equal(a.frameCount,10);assert.equal(a.fps,10);assert.equal(a.frames.length,10);
for(const f of a.frames)assert.match(f.sha256,/^[0-9a-f]{64}$/);
assert(d.unresolved.some(s=>s.includes("Godot")));
assert.equal(d.qualification.passed,false);
console.log("MIG-0.4 scoped source boundary audit PASS; binary assets and Godot project remain unverified.");

const evidence=JSON.parse(read("docs/migration/MIG-0.4-provenance-evidence.json"));
assert.equal(evidence.step,"MIG-0.4");
assert.equal(evidence.qualifyingRun.conclusion,"success");
for(const pr of evidence.pullRequests){assert.match(pr.headSha,/^[0-9a-f]{40}$/);assert(pr.changedPaths.length>0);}
assert.equal(evidence.godot.projectFileFound,false);
assert.equal(evidence.binaryAssets.sha256VerifiedAgainstBytes,0);
assert.equal(evidence.finalStatus,"PARTIAL_NO_FULL_MIG_0_4_QUALIFICATION");
