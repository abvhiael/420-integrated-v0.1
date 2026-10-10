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
    assert.equal(registry.count, 368);
    assert.equal(registry.assets.length, 368);
    assert.equal(new Set(registry.assets.map((a: {url: string}) => a.url)).size, 368);
    assert.ok(registry.assets.every((a: {url:string}) => /^\/assets\/budtender\/phase-3\.(?:[1-9]|1[0-4])\/[a-z0-9_]+\.png$/.test(a.url)));
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
