import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { StoreProgression } from "../../src/budtender/StoreProgression";

describe("StoreProgression BUD-4", () => {
  it("purchases deterministic upgrades and escalates cost", () => {
    const progression = new StoreProgression(1000);
    assert.equal(progression.getUpgradeCost("counterSpeed"), 50);
    assert.equal(progression.purchaseUpgrade("counterSpeed"), 50);
    assert.equal(progression.getUpgradeCost("counterSpeed"), 100);
    assert.equal(progression.snapshot().upgrades.counterSpeed, 1);
  });

  it("fails closed on insufficient cash", () => {
    const progression = new StoreProgression(10);
    const before = progression.snapshot();
    assert.throws(() => progression.purchaseUpgrade("saleValue"), /insufficient cash/);
    assert.deepEqual(progression.snapshot(), before);
  });

  it("enforces configured max levels", () => {
    const progression = new StoreProgression(10000);
    for (let i = 0; i < 5; i++) progression.purchaseUpgrade("decorAppeal");
    assert.equal(progression.snapshot().upgrades.decorAppeal, 5);
    assert.throws(() => progression.purchaseUpgrade("decorAppeal"), /maxed/);
  });

  it("requires expansion stages in canonical order", () => {
    const progression = new StoreProgression(10000);
    assert.throws(() => progression.unlockExpansion("secondCounter"), /prerequisite/);
    progression.unlockExpansion("largerRetailFloor");
    progression.unlockExpansion("secondCounter");
    assert.deepEqual(progression.snapshot().unlockedExpansions, ["tinyShop", "largerRetailFloor", "secondCounter"]);
  });

  it("prevents duplicate expansion unlocks", () => {
    const progression = new StoreProgression(10000);
    progression.unlockExpansion("largerRetailFloor");
    assert.throws(() => progression.unlockExpansion("largerRetailFloor"), /already unlocked/);
  });

  it("never allows negative starting cash or invalid credits", () => {
    assert.throws(() => new StoreProgression(-1), /invalid starting cash/);
    const progression = new StoreProgression();
    assert.throws(() => progression.creditCash(-1), /invalid cash credit/);
    assert.equal(progression.snapshot().cash, 0);
  });
});
