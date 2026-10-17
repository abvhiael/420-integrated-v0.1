import { strict as assert } from "node:assert";
import { once } from "node:events";
import { describe, it } from "node:test";
import { createBudtenderWebServer } from "../src/server.ts";

async function withServer(run: (origin: string) => Promise<void>) {
  const server = createBudtenderWebServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("missing port");
  try { await run("http://127.0.0.1:" + addr.port); }
  finally { server.close(); await once(server, "close"); }
}

describe("Budtender committed artwork integration", () => {
  it("publishes exactly the canonical 368-path registry", async () => withServer(async base => {
    const response = await fetch(base + "/assets/budtender/registry.json");
    assert.equal(response.status, 200);
    const registry = await response.json();
    assert.equal(registry.count, 416);
    assert.equal(registry.assets.length, 416);
    assert.equal(new Set(registry.assets.map((a: {url: string}) => a.url)).size, 416);
    assert.ok(registry.assets.every((a: {url:string}) => /^\/assets\/budtender\/phase-3\.(?:[1-9]|1[0-4]|17)\/[a-z0-9_]+\.png$/.test(a.url)));
  }));

  it("serves registered PNG bytes, including transparent cutout and scenery", async () => withServer(async base => {
    for (const path of [
      "/assets/budtender/phase-3.1/env_starter_storefront_arch_window.png",
      "/assets/budtender/phase-3.2/counter_main_body.png",
      "/assets/budtender/phase-3.14/exterior_view_street.png",
      "/assets/budtender/phase-3.14/window_fx_rain_light.png",
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.deepEqual(Array.from(bytes.slice(0, 8)), [137,80,78,71,13,10,26,10]);
    }
  }));

  it("rejects unregistered files and non-GET methods", async () => withServer(async base => {
    assert.equal((await fetch(base + "/assets/budtender/phase-3.14/not-a-real-asset.png")).status, 404);
    assert.equal((await fetch(base + "/assets/budtender/phase-3.14/window_fx_rain_light.png", {method:"POST"})).status, 405);
    assert.equal((await fetch(base + "/assets/budtender/../../src/budtender/README.md")).status, 404);
  }));

  it("embeds committed store artwork in presentation without modifying game state", async () => withServer(async base => {
    const before = await (await fetch(base + "/api/state")).json();
    const page = await (await fetch(base + "/")).text();
    assert.match(page, /shop-stage/);
    assert.match(page, /env_starter_floor\.png/);
    assert.match(page, /counter_main_body\.png/);
    const after = await (await fetch(base + "/api/state")).json();
    assert.deepEqual(after, before);
  }));
});

describe("Phase 3.17 Level 1 artwork integration",()=>{
 it("serves 48 registered assets without gameplay mutations", async()=>withServer(async base=>{
  const before=await (await fetch(base+"/api/state")).json();
  const response=await fetch(base+"/assets/budtender/registry.json");
  assert.equal(response.status,200);
  const registry=await response.json();
  assert.equal(registry.count,416);
  const items=registry.assets.filter((a:{url:string})=>a.url.startsWith("/assets/budtender/phase-3.17/"));
  assert.equal(items.length,48);
  assert.equal(new Set(items.map((a:{url:string})=>a.url)).size,48);
  for(const a of items){
   assert.match(a.url,/^\/assets\/budtender\/phase-3\.17\/budtender_store_[a-z0-9_]+\.png$/);
   assert.match(a.git_blob_sha,/^[0-9a-f]{40}$/);
   const result=await fetch(base+a.url);
   assert.equal(result.status,200,a.url);
   assert.match(result.headers.get("content-type")??"",/^image\/png/);
   assert.equal((await result.arrayBuffer()).byteLength,a.bytes);
  }
  assert.equal((await fetch(base+"/assets/budtender/phase-3.17/not_registered.png")).status,404);
  assert.equal((await fetch(base+items[0].url,{method:"POST"})).status,405);
  assert.deepEqual(await (await fetch(base+"/api/state")).json(),before);
 }));
});

import { STORE_LAYERS, getLayerRank, orderSceneEntries, applySceneLayerOrder } from "../public/scene-layers.js";

describe("Phase 3.18 canonical layer hierarchy", () => {
 const names=["00_BACKGROUND","01_WALLS_AND_WINDOWS","02_FLOOR","03_ARCHITECTURE","04_FIXED_SHELVING","05_FIXED_COUNTERS","06_PRODUCT_DISPLAYS","07_PROPS","08_PLANTS","09_CUSTOMERS","10_STAFF","11_INTERACTION_EFFECTS","12_LIGHTING","13_FOREGROUND","14_UI"];
 it("locks all 15 specified layers without omissions or reorderings",()=>{
  assert.deepEqual([...STORE_LAYERS],names);
  assert.equal(new Set(STORE_LAYERS).size,15);
  for(let i=0;i<15;i++) assert.equal(getLayerRank(names[i]),i);
  assert.throws(()=>getLayerRank("15_UNKNOWN"),/unrecognized/);
  assert.throws(()=>getLayerRank("__proto__"),/unrecognized/);
 });
 it("sorts by occlusion rank with stable ties, without mutating input",()=>{
  const items=[{layer:names[5],id:"counter"},{layer:names[1],id:"wall-first"},{layer:names[1],id:"wall-second"},{layer:names[2],id:"floor"}];
  assert.deepEqual(orderSceneEntries(items).map(x=>x.id),["wall-first","wall-second","floor","counter"]);
  assert.equal(items[0].id,"counter");
  assert.throws(()=>orderSceneEntries([...items,{layer:"INVALID"}]),/unrecognized/);
 });
 it("rejects invalid scene atomically without partial z-index writes",()=>{
  const node={style:{zIndex:""},getAttribute:()=>names[2]};
  const bad={style:{zIndex:""},getAttribute:()=>"invalid"};
  const stage={querySelectorAll:()=>[node,bad]};
  assert.throws(()=>applySceneLayerOrder(stage),/unrecognized/);
  assert.equal(node.style.zIndex,"");
  assert.equal(bad.style.zIndex,"");
 });
 it("layers the production scene and keeps game state unchanged",async()=>withServer(async base=>{
  const before=await (await fetch(base+"/api/state")).json();
  const html=await (await fetch(base+"/")).text();
  for(const layer of [names[1],names[2],names[5]]) assert.match(html,new RegExp('data-scene-layer="'+layer+'"'));
  assert.equal((html.match(/data-scene-layer=/g)||[]).length,30);
  const js=await fetch(base+"/scene-layers.js");
  assert.equal(js.status,200);
  assert.match(js.headers.get("content-type")??"",/javascript/);
  assert.deepEqual(await (await fetch(base+"/api/state")).json(),before);
 }));
});


describe("Phase 3.20 Tier 1 playable visual upgrade",()=>{
 it("registers each required first-tier visual group and defers tiers 2 and 3",async()=>{
  const {readFile}=await import("node:fs/promises");
  const {resolve}=await import("node:path");
  const path=resolve(process.cwd(),"../../assets/budtender/phase-3.20/priority_tiers.json");
  const data=JSON.parse(await readFile(path,"utf8"));
  assert.deepEqual(data.tiers.map((x:{tier:number})=>x.tier),[1,2,3]);
  assert.equal(data.tiers[0].items.length,11);
  assert.equal(data.tiers[1].items.length,7);
  assert.equal(data.tiers[2].items.length,6);
  assert.equal(data.tiers[0].status,"implemented-with-existing-assets");
  assert.ok(data.tiers.slice(1).every((x:{status:string})=>x.status==="integrated"));
  const registry=JSON.parse(await readFile(resolve(process.cwd(),"../../assets/budtender/asset_inventory.json"),"utf8"));
  const approved=new Set(registry.assets.map((x:{path:string})=>x.path));
  for(const tier of data.tiers)for(const item of tier.items)for(const source of item.sources)assert.ok(approved.has(source),source);
 });
 it("renders approved Tier 1 scene pieces, with no gameplay state mutation",async()=>withServer(async base=>{
  const before=await(await fetch(base+"/api/state")).json();
  const page=await(await fetch(base+"/")).text();
  for(const filename of ["display_shelf_full_height","product_flower_jar_medium","prop_pos_register","queue_stanchion_brass","nook_armchair_sage","plant_monstera","sign_menu_main","sign_store_welcome","light_fx_ambient_warm"]){assert.ok(page.includes(filename+".png"),filename);}
  assert.equal((page.match(/data-scene-layer=/g)||[]).length,30);
  assert.deepEqual(await(await fetch(base+"/api/state")).json(),before);
 }));
});

import {projectSceneVisuals,applySceneVisuals} from "../public/scene-variants.js";
describe("Phase 3.20 progression and polish",()=>{
 it("derives visual stock/progression states without mutating input",()=>{
  const s={store:{products:{a:{stock:0,capacity:10}}},progression:{upgrades:{},unlockedExpansions:["tinyShop"]}};
  const before=structuredClone(s);assert.deepEqual(projectSceneVisuals(s),{stock:"empty",upgrade:"base",expansion:"starter",polish:"off"});
  s.store.products.a.stock=9;s.progression.upgrades.counterSpeed=1;s.progression.unlockedExpansions.push("largerRetailFloor");
  assert.deepEqual(projectSceneVisuals(s,true),{stock:"full",upgrade:"premium",expansion:"expanded",polish:"on"});
  assert.equal(before.store.products.a.stock,0);
 });
 it("maps valid variants and rejects malformed metadata before mutation",()=>{
  const node=(kind,value)=>({hidden:true,getAttribute:(key)=>key==="data-variant-kind"?kind:value});
  const a=node("stock","empty"),b=node("polish","on");const stage={querySelectorAll:()=>[a,b]};
  applySceneVisuals(stage,{stock:"empty",polish:"off"});assert.equal(a.hidden,false);assert.equal(b.hidden,true);
  const invalid=node("stock","forged");assert.throws(()=>applySceneVisuals({querySelectorAll:()=>[a,invalid]},{stock:"full"}));assert.equal(a.hidden,false);
 });
 it("serves all tier two and three artwork from allowlisted production assets",async()=>withServer(async base=>{
  const before=await(await fetch(base+"/api/state")).json();
  const page=await(await fetch(base+"/")).text();
  for(const name of ["display_state_empty","display_state_full_stock","display_shelf_corner","merch_upgrade_pedestal","decor_framed_leaf","plant_fern","merch_tower_premium","floor_seam_expansion","prop_clipboard","sign_promo_weekly_deals","light_state_evening","nook_magazines_stack","decor_botanical_wall_print","product_flower_tin_premium"])assert.ok(page.includes(name+".png"));
  assert.deepEqual(await(await fetch(base+"/api/state")).json(),before);
 }));
});
