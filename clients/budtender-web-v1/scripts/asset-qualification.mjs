import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const inventory = JSON.parse(await readFile(resolve(root,"assets/budtender/asset_inventory.json"),"utf8"));
if(inventory.asset_count!==368 || inventory.assets?.length!==368) throw new Error("expected 368 assets");
const expected = {"3.1":7,"3.2":17,"3.3":16,"3.4":34,"3.5":26,"3.6":24,"3.7":32,"3.8":28,"3.9":28,"3.10":32,"3.11":32,"3.12":28,"3.13":32,"3.14":32};
const phases={}; const paths=new Set();
for(const asset of inventory.assets){
 if(!/^assets\/budtender\/phase-3\.(?:[1-9]|1[0-4])\/[a-z0-9_]+\.png$/.test(asset.path)) throw Error("unsafe path: "+asset.path);
 if(paths.has(asset.path)) throw Error("duplicate path: "+asset.path);
 paths.add(asset.path);
 const bytes=await readFile(resolve(root,asset.path));
 if(bytes.length!==asset.bytes) throw Error("size mismatch: "+asset.path);
 if(createHash("sha256").update(bytes).digest("hex")!==asset.sha256) throw Error("hash mismatch: "+asset.path);
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("invalid PNG: "+asset.path);
 const phase=asset.path.match(/phase-(3\.\d+)\//)?.[1];
 phases[phase]=(phases[phase]||0)+1;
}
if(JSON.stringify(phases)!==JSON.stringify(expected)) {
 for(const [phase,count] of Object.entries(expected)) if(phases[phase]!==count) throw Error("bad phase count: "+phase);
}
console.log("Budtender artwork inventory: PASS (368 distinct PNGs, lengths and SHA-256 checked)");

const hotspots = JSON.parse(await readFile(resolve(root,"assets/budtender/phase-3.16/registry.json"),"utf8"));
if(hotspots.expected_count!==48 || hotspots.registered_count!==48 || hotspots.assets.length!==48 || hotspots.deleted_duplicate_variants.length!==6) throw Error("incomplete or inconsistent hotspot registration");
if(JSON.stringify(hotspots.missing)!==JSON.stringify([])) throw Error("unapproved hotspot gap");
const hotspotNames = new Set();
const digests = new Map();
for(const item of hotspots.assets){
  if(!/^assets\/budtender\/phase-3\.16\/hotspot_[a-z0-9_]+\.png$/.test(item.source)) throw Error("unsafe hotspot path");
  const data=await readFile(resolve(root,item.source));
  if(data.length<100 || !data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("invalid PNG: "+item.source);
  digests.set(item.source,createHash("sha256").update(data).digest("hex"));
}
for(const item of hotspots.assets){
 if(!/^hotspot_[a-z0-9_]+\.png$/.test(item.name) || hotspotNames.has(item.name)) throw Error("invalid or repeated canonical hotspot");
 hotspotNames.add(item.name);
}

console.log("Phase 3.16: PASS 48 uploaded production files, 6 owner-deleted variants recorded; doorway art identity pending review");

const phase317=JSON.parse(await readFile(resolve(root,"assets/budtender/phase-3.17/registry.json"),"utf8"));
const expected317={"A":"open closed opening closing empty quiet normal_traffic busy rush_hour queue_overflow restocking low_stock fully_stocked sold_out premium_merchandising maintenance","B":"morning midday afternoon golden_hour evening nighttime lights_off display_lighting soft_ambient bright_retail overcast rain snow autumn winter_warmth special_event_illumination","C":"spotless normal_wear dirty_floor overflowing_bins damaged_furniture equipment_fault security_alert repair_in_progress restored_equipment renovation construction_barriers newly_unlocked_room premium_upgrade seasonal_decoration inspection_ready post_rush_cleanup"};
if(phase317.expected_count!==48 || phase317.assets?.length!==48) throw Error("3.17 inventory count");
const seen317=new Set();
for(const [group,names] of Object.entries(expected317)) {
 const actual=phase317.assets.filter(a=>a.group===group).map(a=>a.name);
 if(JSON.stringify(actual)!==JSON.stringify(names.split(" ").map(s=>"budtender_store_"+s+".png"))) throw Error("3.17 sheet mismatch "+group);
}
for(const a of phase317.assets){
 if(!/^budtender_store_[a-z0-9_]+\.png$/.test(a.name) || a.source!=="assets/budtender/phase-3.17/"+a.name || seen317.has(a.name)) throw Error("3.17 unsafe name");
 seen317.add(a.name);
 const b=await readFile(resolve(root,a.source));
 if(b.length!==a.bytes || !b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("3.17 invalid PNG "+a.name);
 if(createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex")!==a.git_blob_sha) throw Error("3.17 blob mismatch "+a.name);
 if(b.readUInt8(25)!==6 || b.readUInt32BE(16)<256 || b.readUInt32BE(20)<256) throw Error("3.17 RGBA/resolution qualification "+a.name);
}
console.log("Phase 3.17: PASS 48 distinct file identities, RGBA PNG validation, and 3 sheets");
