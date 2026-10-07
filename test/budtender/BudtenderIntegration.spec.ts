import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BudtenderCustomerSystem } from "../../src/budtender/BudtenderCustomers.ts";
import { BudtenderStore } from "../../src/budtender/BudtenderStore.ts";

describe("Budtender integrated BUD-1 through BUD-4 simulation", () => {
  it("uses one authoritative cash path across sales, restocking, and upgrades", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    customers.addCustomer("sale-1", "flower");
    assert.equal(customers.serveCustomer("sale-1"), 20);
    assert.equal(store.snapshot().cash, 20);

    store.grantStartingCash(100);
    store.restock("flower", 1, 10);
    assert.equal(store.snapshot().cash, 110);

    store.purchaseUpgrade("saleValue");
    assert.equal(store.snapshot().cash, 60);

    customers.addCustomer("sale-2", "flower");
    assert.equal(customers.serveCustomer("sale-2"), 22);
    assert.equal(store.snapshot().cash, 82);
  });

  it("applies BUD-4 shelf-capacity upgrades to the BUD-3 inventory authority", () => {
    const store = new BudtenderStore();
    store.grantStartingCash(50);
    const before = store.snapshot().products.flower.capacity;

    store.purchaseUpgrade("shelfCapacity");

    assert.equal(store.snapshot().products.flower.capacity, before + 2);
    assert.equal(store.snapshot().upgrades.shelfCapacity, 1);
  });
});
