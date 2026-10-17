import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "assets", "budtender", "phase-3.16");
const names = await readdir(dir);
const sha = async (name) => createHash("sha256").update(await readFile(join(dir,name))).digest("hex");
const original = new Map();
for (const name of names) {
  if (name.endsWith(".png.png") && !name.includes(" (1)")) {
    const target = name.slice(0,-4);
    if (names.includes(target)) throw Error("canonical path collision: "+target);
    original.set(name,target);
  } else if (/ \(1\)\.png$/.test(name)) {
    const canonical = name.replace(" (1).png", "");
    const peer = names.includes(canonical + ".png") ? canonical + ".png" : null;
    if (!peer) throw Error("orphan variant: "+name);
    if (await sha(name) === await sha(peer)) throw Error("unexpected byte-identical variant; review before removal: "+name);
    const target = canonical.replace(/\.png$/, "_alternate_1.png");
    if (names.includes(target)) throw Error("alternate path collision: "+target);
    original.set(name,target);
  }
}
if (original.size!==37) throw Error("expected 37 source renames, got "+original.size);
for (const [src,dst] of original) await rename(join(dir,src),join(dir,dst));
const registryPath=join(dir,"registry.json");
const registry=JSON.parse(await readFile(registryPath,"utf8"));
for (const asset of registry.assets) {
  const raw=asset.source.split("/").at(-1);
  asset.source="assets/budtender/phase-3.16/"+(original.get(raw)??raw);
}
for (const variant of registry.preserved_variants) {
  const raw=variant.source.split("/").at(-1);
  variant.source="assets/budtender/phase-3.16/"+(original.get(raw)??raw);
}
await writeFile(registryPath,JSON.stringify(registry,null,2)+"\n");
const final=await readdir(dir);
const pngs=final.filter(x=>x.endsWith(".png"));
if(pngs.length!==53 || pngs.some(x=>x.endsWith(".png.png")||x.includes(" (1)"))) throw Error("normalization inventory invalid");
console.log("Renamed 37 files, preserving all 53 image variants, 47 canonical + 6 alternates");
