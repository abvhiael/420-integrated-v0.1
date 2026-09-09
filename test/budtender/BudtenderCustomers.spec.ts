import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BudtenderCustomerSystem } from "../../src/budtender/BudtenderCustomers";
import { BudtenderStore } from "../../src/budtender/BudtenderStore";

describe("BudtenderCustomerSystem BUD-2", () => {
  it("preserves arrival order in the queue", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    customers.addCustomer("a", "flower");
    customers.addCustomer("b", "preroll");
    customers.addCustomer("c", "edible");

    assert.deepEqual(customers.currentQueue(), ["a", "b", "c"]);
  });

  it("rejects duplicate customer ids", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    customers.addCustomer("a", "flower");
    assert.throws(() => customers.addCustomer("a", "edible"), /duplicate customer id/);
  });

  it("abandons a customer exactly when patience reaches zero", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    customers.addCustomer("a", "flower", "regular", 2);
    customers.tick();
    assert.equal(customers.snapshot().customers[0].status, "queued");
    customers.tick();

    const customer = customers.snapshot().customers[0];
    assert.equal(customer.patienceRemaining, 0);
    assert.equal(customer.status, "abandoned");
    assert.deepEqual(customers.currentQueue(), []);
    assert.throws(() => customers.serveCustomer("a"), /abandoned/);
  });

  it("serves a customer exactly once and settles the matching store order", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    customers.addCustomer("a", "flower");
    assert.equal(customers.serveCustomer("a"), 20);
    assert.equal(store.snapshot().cash, 20);
    assert.equal(store.snapshot().products.flower.stock, 3);
    assert.throws(() => customers.serveCustomer("a"), /already served/);
  });

  it("fails closed when the customer's requested product is unavailable", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);

    for (let i = 0; i < 4; i++) {
      customers.addCustomer(`fill-${i}`, "edible");
      customers.serveCustomer(`fill-${i}`);
    }

    customers.addCustomer("empty", "edible");
    assert.throws(() => customers.serveCustomer("empty"), /unavailable/);
    assert.equal(customers.snapshot().customers.at(-1)?.status, "queued");
    assert.equal(store.snapshot().cash, 32);
  });

  it("exposes the fourTwentyRush profile without directly mutating the store economy", () => {
    const store = new BudtenderStore();
    const customers = new BudtenderCustomerSystem(store);
    const before = store.snapshot();

    customers.setDemandProfile("fourTwentyRush");

    assert.equal(customers.snapshot().demandProfile, "fourTwentyRush");
    assert.deepEqual(store.snapshot(), before);
  });
});
