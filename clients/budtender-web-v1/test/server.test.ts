import { strict as assert } from "node:assert";
import { once } from "node:events";
import { describe, it } from "node:test";
import { createBudtenderWebServer } from "../src/server.ts";

const withServer = async (run: (baseUrl: string) => Promise<void>): Promise<void> => {
  const server = createBudtenderWebServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
};

const post = async (baseUrl: string, path: string, body: unknown) =>
  fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Budtender web client host", () => {
  it("serves the responsive presentation shell", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(baseUrl + "/");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      const html = await response.text();
      assert.match(html, /Budtender/);
      assert.match(html, /viewport-fit=cover/);
      assert.match(html, /\/app\.js/);
    });
  });

  it("exposes snapshots from the application service without browser-owned state", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(baseUrl + "/api/state");
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.equal(state.store.cash, 0);
      assert.equal(state.store.products.flower.stock, 4);
      assert.deepEqual(state.customers.queue, []);
      assert.equal(state.progression.upgrades.saleValue, 0);
    });
  });

  it("routes customer creation and single-use settlement through application authority", async () => {
    await withServer(async (baseUrl) => {
      const created = await post(baseUrl, "/api/customers", {
        id: "web-test-1",
        product: "flower",
        archetype: "regular",
      });
      assert.equal(created.status, 201);

      const served = await post(baseUrl, "/api/customers/web-test-1/serve", {});
      assert.equal(served.status, 200);
      const result = await served.json();
      assert.equal(result.sale, 20);
      assert.equal(result.state.store.cash, 20);
      assert.equal(result.state.store.products.flower.stock, 3);

      const replay = await post(baseUrl, "/api/customers/web-test-1/serve", {});
      assert.equal(replay.status, 400);
      assert.match((await replay.json()).error, /already served/);
    });
  });

  it("keeps canonical restock pricing server-side", async () => {
    await withServer(async (baseUrl) => {
      await post(baseUrl, "/api/customers", { id: "sale-1", product: "flower" });
      await post(baseUrl, "/api/customers/sale-1/serve", {});

      const response = await post(baseUrl, "/api/restock", {
        product: "flower",
        units: 1,
        unitCost: 0,
      });
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.equal(state.store.cash, 10);
      assert.equal(state.store.products.flower.stock, 4);
    });
  });

  it("routes progression commands through the service and preserves failure paths", async () => {
    await withServer(async (baseUrl) => {
      const insufficient = await post(baseUrl, "/api/upgrades", { track: "decorAppeal" });
      assert.equal(insufficient.status, 400);
      assert.match((await insufficient.json()).error, /insufficient cash/);

      for (let index = 0; index < 3; index++) {
        const id = "upgrade-sale-" + index;
        await post(baseUrl, "/api/customers", { id, product: "flower" });
        await post(baseUrl, "/api/customers/" + id + "/serve", {});
      }

      const upgraded = await post(baseUrl, "/api/upgrades", { track: "decorAppeal" });
      assert.equal(upgraded.status, 200);
      const state = await upgraded.json();
      assert.equal(state.progression.upgrades.decorAppeal, 1);
      assert.equal(state.store.cash, 15);
    });
  });

  it("rejects unknown API routes and oversized JSON bodies", async () => {
    await withServer(async (baseUrl) => {
      const unknown = await post(baseUrl, "/api/not-real", {});
      assert.equal(unknown.status, 404);

      const oversized = await post(baseUrl, "/api/customers", {
        id: "x".repeat(20_000),
        product: "flower",
      });
      assert.equal(oversized.status, 400);
      assert.match((await oversized.json()).error, /too large/);
    });
  });

  it("does not expose an endpoint that applies offline rewards", async () => {
    await withServer(async (baseUrl) => {
      const response = await post(baseUrl, "/api/offline/apply", {
        lastProcessedAtMs: 0,
        nowMs: 1_000,
      });
      assert.equal(response.status, 404);

      const state = await (await fetch(baseUrl + "/api/state")).json();
      assert.equal(state.store.cash, 0);
    });
  });
});
