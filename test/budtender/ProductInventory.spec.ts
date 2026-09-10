import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ProductInventory, STARTER_CATALOG } from "../../src/budtender/ProductInventory";

describe("ProductInventory BUD-3", () => {
  it("loads the starter catalog deterministically", () => {
    const inventory = new ProductInventory(STARTER_CATALOG);
    assert.equal(inventory.list().length, 3);
    assert.equal(inventory.get("flower-house").stock, 4);
    assert.equal(inventory.get("preroll-house").baseDemand, 80);
  });

  it("rejects duplicate product ids", () => {
    const inventory = new ProductInventory();
    inventory.register(STARTER_CATALOG[0]);
    assert.throws(() => inventory.register(STARTER_CATALOG[0]), /duplicate product id/);
  });

  it("keeps stock within zero and capacity bounds", () => {
    const inventory = new ProductInventory(STARTER_CATALOG);
    assert.equal(inventory.consume("flower-house"), 20);
    assert.equal(inventory.get("flower-house").stock, 3);
    assert.throws(() => inventory.consume("flower-house", 4), /insufficient stock/);
    assert.throws(() => inventory.restock("flower-house", 6), /exceeds capacity/);
  });

  it("returns deterministic wholesale restock cost", () => {
    const inventory = new ProductInventory(STARTER_CATALOG);
    const cost = inventory.restock("flower-house", 2);
    assert.equal(cost, 20);
    assert.equal(inventory.get("flower-house").stock, 6);
  });

  it("fails closed for locked products", () => {
    const inventory = new ProductInventory([
      {
        id: "premium-flower",
        name: "Premium Flower",
        category: "flower",
        quality: "premium",
        baseSalePrice: 30,
        wholesaleUnitCost: 15,
        baseDemand: 50,
        capacity: 6,
      },
    ]);

    assert.throws(() => inventory.restock("premium-flower", 1), /product locked/);
    assert.throws(() => inventory.consume("premium-flower", 1), /product locked/);

    inventory.unlock("premium-flower");
    assert.equal(inventory.restock("premium-flower", 1), 15);
    assert.equal(inventory.consume("premium-flower"), 30);
  });

  it("rejects invalid demand and negative product economics", () => {
    assert.throws(
      () =>
        new ProductInventory([
          {
            id: "bad-demand",
            name: "Bad Demand",
            category: "edible",
            quality: "budget",
            baseSalePrice: 5,
            wholesaleUnitCost: 2,
            baseDemand: 101,
            capacity: 2,
          },
        ]),
      /demand out of bounds/,
    );

    assert.throws(
      () =>
        new ProductInventory([
          {
            id: "bad-price",
            name: "Bad Price",
            category: "preroll",
            quality: "standard",
            baseSalePrice: 5,
            wholesaleUnitCost: 6,
            baseDemand: 50,
            capacity: 2,
          },
        ]),
      /wholesale cost exceeds/,
    );
  });
});
