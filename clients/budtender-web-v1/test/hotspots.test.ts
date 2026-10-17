import { strict as assert } from "node:assert";
import { once } from "node:events";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { createBudtenderWebServer } from "../src/server.ts";

async function withServer(check: (origin: string) => Promise<void>) {
 const server=createBudtenderWebServer();server.listen(0,"127.0.0.1");await once(server,"listening");
 const address=server.address();if(!address||typeof address==="string")throw Error("no listener");
 try{await check("http://127.0.0.1:"+address.port);}finally{server.close();await once(server,"close");}
}
describe("Phase 3.16 hotspot inventory, presentation and security",()=>{
 it("records 48 uploaded production files and records the six owner-deleted alternates",async()=>{
  const registry=JSON.parse(await readFile(new URL("../../../assets/budtender/phase-3.16/registry.json",import.meta.url),"utf8"));
  assert.equal(registry.assets.length,48);
  assert.equal(registry.deleted_duplicate_variants.length,6);
  assert.deepEqual(registry.missing,[]);
  const names=new Set(registry.assets.map((a:{name:string})=>a.name));assert.equal(names.size,48);
 });
 it("serves only allowlisted canonical hotspot images",()=>withServer(async base=>{
  const registry=await(await fetch(base+"/assets/budtender/hotspots.json")).json();
  assert.equal(registry.count,48);assert.equal(registry.incomplete,false);
  for(const name of ["hotspot_available.png","hotspot_locked.png","hotspot_inventory_storage.png","hotspot_frame_circle.png"]){
   const response=await fetch(base+"/assets/budtender/phase-3.16/"+name);
   assert.equal(response.status,200,name);assert.match(response.headers.get("content-type")??"",/image\/png/);
   const bytes=new Uint8Array(await response.arrayBuffer());
   assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  }
  assert.equal((await fetch(base+"/assets/budtender/phase-3.16/hotspot_expansion_doorway.png")).status,200);
  assert.equal((await fetch(base+"/assets/budtender/phase-3.16/hotspot_locked.png",{method:"POST"})).status,405);
 }));
 it("exposes accessible hotspot navigation without mutating game state",()=>withServer(async base=>{
  const before=await(await fetch(base+"/api/state")).json();
  const html=await(await fetch(base+"/")).text();
  assert.match(html,/hotspot-grid/);assert.match(html,/aria-label="Open stock management"/);
  assert.match(html,/aria-label="Open expansion management"/);
  const after=await(await fetch(base+"/api/state")).json();assert.deepEqual(after,before);
 }));
});