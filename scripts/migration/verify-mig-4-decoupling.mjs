#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const proof=read("docs/migration/MIG-4-verified-game-assets.json");
const apps=read("config/genesis-applications.json");
const names=apps.apps.map(a=>a.name);
assert(!names.includes("420Arcade"),"420Arcade must be deferred");
assert(names.includes("420 Gaming Protocol"),"Gaming Protocol must remain Genesis");
assert(apps.amendments?.some(a=>a.id==="GENESIS_APPLICATION_DECISION_1_ARCADE_DEFERRAL_2026_10_24"),"deferral amendment required");
assert.equal(proof.testnet,"NOT_QUALIFIED");
assert.equal(proof.gitBlobMatches.length,1067);
assert.equal(proof.removedLegacyWorkflows.length,25);
for(const entry of proof.gitBlobMatches){
 assert(/^(assets\/arcade\/|assets\/budtender\/)/.test(entry.path));
 assert(!fs.existsSync(entry.path),"game-specific art still present: "+entry.path);
 assert(/^[0-9a-f]{40}$/.test(entry.blobSha));
}
for(const path of proof.removedLegacyWorkflows)assert(!fs.existsSync(path),"Game-owned workflow still active: "+path);
for(const path of ["packages/420-gaming-sdk/package.json","docs/developers/gaming-protocol.md","docs/migration/MIG-3-level2-ecosystem-qualification.md","docs/migration/MIGRATION-TESTNET-ROADMAP.md"])assert(fs.existsSync(path),"Genesis protocol or evidence missing: "+path);
assert(fs.existsSync("contracts/src/gaming/GameRegistry420.sol"),"Canonical Gaming Registry missing");
assert(fs.existsSync("contracts/src/highcountry"),"High Country contract tree missing");
console.log("MIG-4 Level 1 scope PASS — external art removed with immutable manifest, game CI removed, Arcade deferred, shared Gaming Protocol/SDK and High Country preserved; live testnet not claimed");
