import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BudtenderStore } from "../../src/budtender/BudtenderStore";

describe("BudtenderStore BUD-1", () => {
  it("serves a valid starter-product order exactly once", () => {
    const store = new BudtenderStore();
    store.createOrder("order-1", "flower");

    const sale = store.serveOrder("order-1");
    assert.equal(sale, 20);
    assert.equal(store.snapshot().cash, 20);
    assert.equal(store.snapshot().products.flower.stock, 3);
    assert.throws(() => store.serveOrder("order-1"), /already served/);
  });

  it("fails closed when stock is exhausted", () => {
    const store = new BudtenderStore();
    for (let i = 0; i < 4; i++) {
      const id = `order-${i}`;
      store.createOrder(id, "edible");
      store.serveOrder(id);
    }

    store.createOrder("order-empty", "edible");
    assert.throws(() => store.serveOrder("order-empty"), /unavailable/);
    assert.equal(store.snapshot().products.edible.stock, 0);
  });

  it("prevents restocking above capacity or spending below zero", () => {
    const store = new BudtenderStore();
    assert.throws(() => store.restock("flower", 3, 1), /exceeds capacity/);
    assert.throws(() => store.restock("flower", 1, 1), /insufficient cash/);
  });

  it("supports a valid sell-restock loop", () => {
    const store = new BudtenderStore();
    store.createOrder("order-1", "preroll");
    store.serveOrder("order-1");
    store.restock("preroll", 1, 4);

    const snapshot = store.snapshot();
    assert.equal(snapshot.cash, 6);
    assert.equal(snapshot.products.preroll.stock, 4);
  });

  it("upgrades shelf capacity and enforces the configured maximum level", () => {
    const store = new BudtenderStore();
    store.grantStartingCash(1000);

    for (let i = 0; i < 5; i++) store.purchaseUpgrade("shelfCapacity");

    const snapshot = store.snapshot();
    assert.equal(snapshot.upgrades.shelfCapacity, 5);
    assert.equal(snapshot.products.flower.capacity, 16);
    assert.throws(() => store.purchaseUpgrade("shelfCapacity"), /maxed/);
  });

  it("applies sale-value upgrades deterministically", () => {
    const store = new BudtenderStore();
    store.grantStartingCash(50);
    store.purchaseUpgrade("saleValue");
    store.createOrder("order-1", "flower");

    assert.equal(store.serveOrder("order-1"), 22);
  });
});
