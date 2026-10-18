import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
const proposal=read("docs/arcade/ARC-0.3-GENESIS-INCLUSION-RECONCILIATION.md");
const genesis=JSON.parse(read("config/genesis-applications.json"));
assert.equal(genesis.decision_id,"GENESIS_APPLICATION_DECISION_1");
assert.equal(genesis.status,"FROZEN");
assert.equal(genesis.schema,"420-genesis-application-decision-v9");
assert.ok(genesis.apps.some(x=>x.name==="420 Gaming Protocol"));
assert.ok(!genesis.apps.some(x=>/420\s*Arcade/i.test(x.name)),"Unauthorized Genesis amendment");
assert.match(read("docs/arcade/ARC-0.1-LEVEL1-QUALIFICATION.md"),/c060503d168d044848e6957862966dcbe983072c/);
assert.match(read("docs/arcade/ARC-0.2-LEVEL1-QUALIFICATION.md"),/9af076fe18e86bd4e88a920032ef9c23245e2e37/);
const games=["Kush Crush","420Colouring Book","420Buddy","Bong Breaker","Baked Invaders","Puff-Man","Grasshopper","Roach Run","High Climb","Where's Dave?","Mad Bud Delivery"];
for(const game of games) assert.ok(proposal.includes(game),"Candidate missing "+game);
for(const phrase of ["BLOCKED_ON_GENESIS_AUTHORIZATION","FROZEN","not an authorization","GP-17","ARC-TN","No new Genesis contracts","registry","authorization","PR merge order","ARC-0.4"]){assert.ok(proposal.toLowerCase().includes(phrase.toLowerCase()),"Missing decision safeguard: "+phrase)}
for(const p of ["docs/GENESIS-DAPPS.md","config/protocol.json","docs/arcade/ARC-0.2-ARCHITECTURE-DECISIONS.md"])assert.ok(fs.statSync(p).isFile(),"Missing cross-reference "+p);
console.log("ARC-0.3 proposal integrity PASS: 11 games, frozen Genesis unchanged, inherited SHA evidence and authorization BLOCKED. This does not authorize Genesis inclusion.");
