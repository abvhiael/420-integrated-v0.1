import test from "node:test";
import assert from "node:assert/strict";
import {
  BUDTENDER_GAME_ID,
  BudtenderFeature,
  createBudtenderGamingClient,
  evaluateBudtenderAccess
} from "../src/access.js";

const guest = { registered: false, walletLinked: false, walletConnected: false };
const registered = { registered: true, walletLinked: false, walletConnected: false };
const linkedDisconnected = { registered: true, walletLinked: true, walletConnected: false };
const linkedConnected = { registered: true, walletLinked: true, walletConnected: true };

test("core management remains wallet-free", () => {
  const access = evaluateBudtenderAccess({ feature: BudtenderFeature.CORE_MANAGEMENT, ...guest });
  assert.equal(access.allowed, true);
  assert.equal(access.prompt, "none");
});

test("cloud save requires registration but not wallet", () => {
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CLOUD_SAVE, ...guest }).prompt, "register");
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.CLOUD_SAVE, ...registered }).allowed, true);
});

test("optional wallet content uses link then reconnect boundaries", () => {
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.PREMIUM_DECOR, ...registered }).prompt, "link-wallet");
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.PREMIUM_DECOR, ...linkedDisconnected }).prompt, "connect-wallet");
  assert.equal(evaluateBudtenderAccess({ feature: BudtenderFeature.PREMIUM_DECOR, ...linkedConnected }).allowed, true);
});

test("unsupported features fail closed", () => {
  assert.throws(() => evaluateBudtenderAccess({ feature: "sales-speed-boost", ...linkedConnected }), /Unsupported Budtender feature/);
});

test("shared SDK adapters are scoped to the Budtender game namespace", async () => {
  let observedGameId;
  const client = createBudtenderGamingClient({
    getProfile: async ({ gameId }) => { observedGameId = gameId; return null; },
    ensureProfile: async () => null,
    getEntitlement: async () => null,
    prepareMigration: async () => null,
    getMigrationClaim: async () => null,
    getSessionStatus: async () => null,
    verifyAttestation: async () => null
  });
  await client.getProfile("0x0000000000000000000000000000000000000001");
  assert.equal(observedGameId, BUDTENDER_GAME_ID);
});
