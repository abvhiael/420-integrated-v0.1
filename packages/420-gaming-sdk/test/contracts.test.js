import test from "node:test";
import assert from "node:assert/strict";
import { GamingAdapterMethod, validateGamingAdapters } from "../src/index.js";

test("adapter validation reports missing protocol boundaries", () => {
  const result = validateGamingAdapters({
    [GamingAdapterMethod.GET_PROFILE]: async () => ({})
  });
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes(GamingAdapterMethod.GET_ENTITLEMENT));
  assert.ok(result.missing.includes(GamingAdapterMethod.VERIFY_ATTESTATION));
});

test("adapter validation accepts a complete game transport", () => {
  const adapters = Object.fromEntries(
    Object.values(GamingAdapterMethod).map((name) => [name, async () => ({})])
  );
  const result = validateGamingAdapters(adapters);
  assert.equal(result.valid, true);
  assert.deepEqual(result.missing, []);
});
