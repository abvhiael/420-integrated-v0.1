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

const expansion = JSON.parse(await readFile(resolve(root,"assets/budtender/phase-3.15/registry.json"),"utf8"));
if(expansion.asset_count!==64 || expansion.assets?.length!==64) throw Error("expected 64 expansion assets");
for(const asset of expansion.assets){
 if(!/^assets\/budtender\/phase-3\.15\/[a-z0-9_]+\.png$/.test(asset.path)) throw Error("bad expansion path");
 if(paths.has(asset.path)) throw Error("duplicate expansion path");
 paths.add(asset.path);
 const bytes=await readFile(resolve(root,asset.path));
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("invalid expansion PNG: "+asset.path);
 if(bytes.length<100) throw Error("empty expansion PNG: "+asset.path);
}
if(paths.size!==432) throw Error("expected 432 unique production assets");
console.log("Phase 3.15: PASS (64 PNGs and full 432-path registry)");
