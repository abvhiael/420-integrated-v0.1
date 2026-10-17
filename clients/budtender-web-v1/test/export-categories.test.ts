import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {describe,it} from "node:test";
import {EXPORT_PREFIXES,validateExportCatalog} from "../public/export-categories.js";
const root=new URL("../../../",import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),"utf8"));
const catalog=read("assets/budtender/phase-3.19/export_catalog.json");
const legacy=read("assets/budtender/asset_inventory.json");
const states=read("assets/budtender/phase-3.17/registry.json");
const sources=[...legacy.assets.map(x=>x.path),...states.assets.map(x=>x.source)];
describe("Phase 3.19 export categories",()=>{
 it("preserves all seven exact prefixes and all 416 source identities",()=>{
  assert.deepEqual(EXPORT_PREFIXES,{env:"env_",fixture:"fixture_",prop:"prop_",plant:"plant_",sign:"sign_",light:"light_",decal:"decal_"});
  assert.equal(catalog.asset_count,416);
  assert.equal(validateExportCatalog(catalog,sources),true);
  const bySource=new Map(catalog.assets.map(x=>[x.source,x]));
  for(const a of legacy.assets){assert.equal(bySource.get(a.path).source_sha256,a.sha256);assert.equal(bySource.get(a.path).bytes,a.bytes)}
  for(const a of states.assets){assert.equal(bySource.get(a.source).git_blob_sha,a.git_blob_sha);assert.equal(bySource.get(a.source).bytes,a.bytes)}
  for(const cat of Object.keys(EXPORT_PREFIXES))assert.ok(catalog.assets.some(x=>x.category===cat));
 });
 it("fails closed on invalid category, source, output, duplicate and missing mapping",()=>{
  const bad=edit=>{const copy=structuredClone(catalog);edit(copy);assert.throws(()=>validateExportCatalog(copy,sources));};
  bad(x=>x.assets[0].category="unknown");bad(x=>x.assets[0].source="../escape.png");
  bad(x=>x.assets[0].export_name="wrong.png");bad(x=>x.assets[1].export_name=x.assets[0].export_name);
  bad(x=>x.assets.pop());bad(x=>x.assets[0].bytes=0);
 });
});
