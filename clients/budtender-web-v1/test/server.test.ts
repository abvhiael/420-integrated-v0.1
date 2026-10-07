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

  it("reports the canonical Gaming Protocol integration without inventing session authority", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(baseUrl + "/api/gaming");
      assert.equal(response.status, 200);
      const gaming = await response.json();
      assert.equal(gaming.gameId, "420/GAMING/GAME/BUDTENDER/V1");
      assert.equal(gaming.runtime, "deployment-pending");
      assert.equal(gaming.authoritativeSessionState, false);
      assert.deepEqual(gaming.coreFeatures, ["core-management"]);
      assert.ok(gaming.walletOptionalFeatures.includes("premium-decor"));
      assert.ok(gaming.walletOptionalFeatures.includes("reward"));
    });
  });

  it("evaluates progressive access without mutating gameplay state", async () => {
    await withServer(async (baseUrl) => {
      const before = await (await fetch(baseUrl + "/api/state")).json();

      const guestCore = await post(baseUrl, "/api/gaming/access", {
        feature: "core-management",
        registered: false,
        walletLinked: false,
        walletConnected: false,
      });
      assert.equal(guestCore.status, 200);
      const guestDecision = await guestCore.json();
      assert.equal(guestDecision.decision.allowed, true);
      assert.equal(guestDecision.gameStateUnchanged, true);
      assert.equal(guestDecision.authoritativeSessionState, false);

      const registeredPremium = await post(baseUrl, "/api/gaming/access", {
        feature: "premium-decor",
        registered: true,
        walletLinked: false,
        walletConnected: false,
      });
      assert.equal(registeredPremium.status, 200);
      const premiumDecision = await registeredPremium.json();
      assert.equal(premiumDecision.decision.allowed, false);
      assert.equal(premiumDecision.decision.prompt, "link-wallet");
      assert.equal(premiumDecision.gameStateUnchanged, true);

      const after = await (await fetch(baseUrl + "/api/state")).json();
      assert.deepEqual(after, before);
    });
  });

  it("wallet-linked policy evaluation cannot change core management statistics", async () => {
    await withServer(async (baseUrl) => {
      const before = await (await fetch(baseUrl + "/api/state")).json();

      const response = await post(baseUrl, "/api/gaming/access", {
        feature: "premium-decor",
        registered: true,
        walletLinked: true,
        walletConnected: true,
      });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.decision.allowed, true);
      assert.equal(result.gameStateUnchanged, true);

      const after = await (await fetch(baseUrl + "/api/state")).json();
      assert.equal(after.store.cash, before.store.cash);
      assert.deepEqual(after.store.products, before.store.products);
      assert.deepEqual(after.progression, before.progression);
      assert.deepEqual(after.customers, before.customers);
    });
  });

  it("unknown Gaming Protocol features fail closed", async () => {
    await withServer(async (baseUrl) => {
      const response = await post(baseUrl, "/api/gaming/access", {
        feature: "sales-speed-boost",
        registered: true,
        walletLinked: true,
        walletConnected: true,
      });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /Unsupported Budtender feature/);
    });
  });

  it("sends baseline browser security headers on static and API responses", async () => {
    await withServer(async (baseUrl) => {
      for (const path of ["/", "/api/state"]) {
        const response = await fetch(baseUrl + path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
        assert.equal(response.headers.get("referrer-policy"), "no-referrer");
        assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
        assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
        assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
        assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
      }
    });
  });

  it("rejects non-JSON mutation requests before game state changes", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(baseUrl + "/api/customers", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ id: "csrf-attempt", product: "flower" }),
      });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /application\/json required/);

      const state = await (await fetch(baseUrl + "/api/state")).json();
      assert.deepEqual(state.customers.queue, []);
      assert.equal(state.store.products.flower.stock, 4);
      assert.equal(state.store.cash, 0);
    });
  });

  it("rejects cross-origin JSON mutations before game state changes", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(baseUrl + "/api/customers", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": "https://hostile.example",
        },
        body: JSON.stringify({ id: "cross-origin-attempt", product: "flower" }),
      });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /cross-origin mutation rejected/);

      const state = await (await fetch(baseUrl + "/api/state")).json();
      assert.deepEqual(state.customers.queue, []);
      assert.equal(state.store.cash, 0);
    });
  });

  it("allows same-origin JSON mutation requests", async () => {
    await withServer(async (baseUrl) => {
      const origin = new URL(baseUrl).origin;
      const response = await fetch(baseUrl + "/api/customers", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": origin,
        },
        body: JSON.stringify({ id: "same-origin", product: "flower" }),
      });
      assert.equal(response.status, 201);

      const state = await response.json();
      assert.deepEqual(state.customers.queue, ["same-origin"]);
      assert.equal(state.customers.customers[0].id, "same-origin");
    });
  });

  it("keeps static serving rooted and fails closed on traversal-shaped paths", async () => {
    await withServer(async (baseUrl) => {
      for (const path of ["/..%2fpackage.json", "/%2e%2e%2fpackage.json", "/missing.txt"]) {
        const response = await fetch(baseUrl + path);
        assert.ok(response.status === 400 || response.status === 404);
        const body = await response.text();
        assert.doesNotMatch(body, /"name"\s*:\s*"@420\/budtender-web-v1"/);
      }
    });
  });
});
