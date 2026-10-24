import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../../",import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),"utf8");
const d=JSON.parse(read("docs/migration/MIG-0.2-boundaries.json"));
assert.equal(d.schema,"420-migration-integration-boundaries-v1");
const pkg=JSON.parse(read(d.sdk.path));
assert.equal(pkg.name,d.sdk.name);assert.equal(pkg.version,d.sdk.version);
assert.equal(pkg.private,d.sdk.private);
const runtime=JSON.parse(read("deployments/gaming/testnet.runtime.json"));
assert.equal(runtime.chainId,null,"Audit assumptions changed: update MIG-0.2 if live deployment is resolved");
assert.equal(runtime.status,"UNRESOLVED_UNTIL_DEPLOYMENT");
const ids=new Set();
for(const c of d.consumers){
 assert(!ids.has(c.destination));ids.add(c.destination);
 assert(existsSync(new URL(c.adapter,root)));
 if(c.directImport!=="REQUIRES_MODULE_IMPORT_SCAN"){
  const text=read(c.adapter);
  assert(text.includes(c.directImport),c.destination+": SDK import drift");
  assert(text.includes(c.gameId),c.destination+": game ID drift");
  for(const k of [c.core,c.registered,c.wallet])assert(text.includes(k),c.destination+": feature mapping drift "+k);
  assert(runtime.games.some(g=>g.gameIdDomain===c.gameId),c.destination+": runtime ID drift");
 }
}
assert.deepEqual([...ids].sort(),["420-arcade","420-budtender","420-green-road","420-smoke-and-chrome"].sort());
for(const x of d.canonical)assert(x.owner==="genesis");
for(const c of d.couplings)assert(existsSync(new URL(c.path,root)),c.path);
const e2e=read("packages/420-gaming-client-hardening/test/four-game-e2e.test.js");
const cross=read("packages/420-gaming-cross-game-qualification/test/cross-game.test.js");
for(const f of ["greenroad-access-v1","budtender-access-v1","smoke-chrome-access-v1","highcountry-access-v1"]){
 assert(e2e.includes(f)&&cross.includes(f),"Missing expected cross-game dependency: "+f);
}
assert.equal(d.qualification.passed,false,"No PASS without exact-SHA CI evidence");
console.log("MIG-0.2 static dependency boundary audit PASS: four consumers, canonical SDK, core authority and CI coupling.");
