import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BudtenderApplicationService } from "../../src/budtender/BudtenderApplicationService.ts";

const HOUR = 60 * 60 * 1000;

describe("BudtenderApplicationService BUD-AUDIT-6", () => {
  it("routes the playable customer sale and canonical restock loop through one service", () => {
    const app = new BudtenderApplicationService();

    app.arriveCustomer({ id: "c1", product: "flower" });
    assert.equal(app.serveCustomer("c1"), 20);
    app.restock("flower", 1);

    const snapshot = app.snapshot();
    assert.equal(snapshot.store.cash, 10);
    assert.equal(snapshot.store.products.flower.stock, 4);
    assert.equal(snapshot.customers.customers[0]?.status, "served");
  });

  it("routes all BUD-4 upgrade tracks through the authoritative store progression state", () => {
    const app = new BudtenderApplicationService();

    for (let i = 0; i < 3; i++) {
      app.arriveCustomer({ id: `sale-${i}`, product: "flower" });
      app.serveCustomer(`sale-${i}`);
    }

    app.purchaseUpgrade("decorAppeal");

    const snapshot = app.snapshot();
    assert.equal(snapshot.progression.upgrades.decorAppeal, 1);
    assert.equal(snapshot.store.cash, 15);
  });

  it("preserves shelf-capacity side effects when using the generic progression command", () => {
    const app = new BudtenderApplicationService();

    for (let i = 0; i < 3; i++) {
      app.arriveCustomer({ id: `shelf-${i}`, product: "flower" });
      app.serveCustomer(`shelf-${i}`);
    }

    const before = app.snapshot().store.products.flower.capacity;
    app.purchaseUpgrade("shelfCapacity");

    const snapshot = app.snapshot();
    assert.equal(snapshot.progression.upgrades.shelfCapacity, 1);
    assert.equal(snapshot.store.products.flower.capacity, before + 2);
    assert.equal(snapshot.store.cash, 10);
  });

  it("exposes expansion transitions without exposing the progression object", () => {
    const app = new BudtenderApplicationService();
    assert.throws(() => app.unlockExpansion("secondCounter"), /prerequisite/);
    assert.deepEqual(app.snapshot().progression.unlockedExpansions, ["tinyShop"]);
  });

  it("keeps customer lifecycle and demand profile behind sanctioned commands", () => {
    const app = new BudtenderApplicationService();

    app.setDemandProfile("fourTwentyRush");
    app.arriveCustomer({
      id: "impatient",
      product: "edible",
      archetype: "impatient",
      patienceOverride: 1,
    });
    app.tickCustomers();

    const snapshot = app.snapshot();
    assert.equal(snapshot.customers.demandProfile, "fourTwentyRush");
    assert.equal(snapshot.customers.customers[0]?.status, "abandoned");
    assert.throws(() => app.serveCustomer("impatient"), /abandoned/);
  });

  it("returns detached snapshots that cannot mutate authoritative state", () => {
    const app = new BudtenderApplicationService();
    const snapshot = app.snapshot();

    snapshot.store.cash = 999_999;
    snapshot.store.products.flower.stock = 0;
    snapshot.progression.upgrades.saleValue = 5;
    snapshot.customers.queue.push("forged");

    const fresh = app.snapshot();
    assert.equal(fresh.store.cash, 0);
    assert.equal(fresh.store.products.flower.stock, 4);
    assert.equal(fresh.progression.upgrades.saleValue, 0);
    assert.deepEqual(fresh.customers.queue, []);
  });

  it("does not expose test-only cash injection or raw domain authorities", () => {
    const app = new BudtenderApplicationService() as unknown as Record<string, unknown>;

    assert.equal("grantStartingCash" in app, false);
    assert.equal("createOrder" in app, false);
    assert.equal("creditCash" in app, false);
    assert.equal("store" in app, false);
    assert.equal("customers" in app, false);
    assert.equal("inventory" in app, false);
    assert.equal("progression" in app, false);
  });

  it("evaluates offline progression without applying caller-supplied rewards", () => {
    const app = new BudtenderApplicationService();
    const before = app.snapshot();

    const offline = app.evaluateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 2 * HOUR,
      incomeSources: [{
        id: "future-automation",
        intervalMs: HOUR,
        cashPerInterval: 25,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    assert.equal(offline.totalCash, 50);
    assert.deepEqual(app.snapshot(), before);
  });

  it("fails closed through underlying domain invariants", () => {
    const app = new BudtenderApplicationService();

    assert.throws(
      () => app.arriveCustomer({ id: "", product: "flower" }),
      /customer id/,
    );
    assert.throws(() => app.restock("flower", 1), /insufficient cash/);
    assert.throws(() => app.purchaseUpgrade("saleValue"), /insufficient cash/);
  });
});
