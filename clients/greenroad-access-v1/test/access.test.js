import test from "node:test";
import assert from "node:assert/strict";

import {
  GreenRoadFeature,
  GREEN_ROAD_GAME_ID,
  createGreenRoadGamingClient,
  evaluateGreenRoadAccess
} from "../src/access.js";

const guest = { registered: false, walletLinked: false, walletConnected: false };
const registered = { registered: true, walletLinked: false, walletConnected: false };
const linkedDisconnected = { registered: true, walletLinked: true, walletConnected: false };
const linkedConnected = { registered: true, walletLinked: true, walletConnected: true };

test("core road-trip gameplay remains wallet-free", () => {
  const result = evaluateGreenRoadAccess({ feature: GreenRoadFeature.CORE_ROAD_TRIP, ...guest });
  assert.equal(result.allowed, true);
  assert.equal(result.prompt, "none");
});

test("cloud save requires registration but not a wallet", () => {
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CLOUD_SAVE, ...guest }).prompt, "register");
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.CLOUD_SAVE, ...registered }).allowed, true);
});

test("optional ecosystem features prompt only at the feature boundary", () => {
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.SECRET_ROUTE, ...registered }).prompt, "link-wallet");
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.SECRET_ROUTE, ...linkedDisconnected }).prompt, "connect-wallet");
  assert.equal(evaluateGreenRoadAccess({ feature: GreenRoadFeature.SECRET_ROUTE, ...linkedConnected }).allowed, true);
});

test("Green Road client scopes every adapter request to its canonical game id", async () => {
  const seen = [];
  const adapters = Object.fromEntries([
    "getProfile",
    "ensureProfile",
    "getEntitlement",
    "prepareMigration",
    "getMigrationClaim",
    "getSessionStatus",
    "verifyAttestation"
  ].map((name) => [name, async (input) => { seen.push([name, input.gameId]); return input; }]));

  const client = createGreenRoadGamingClient(adapters);
  await client.getProfile("0xabc");
  await client.ensureProfile("0xabc");
  await client.getEntitlement({ profileId: "p1", entitlementId: "e1" });
  await client.prepareMigration({ targetAccount: "0xabc", guestStateCommitment: "g", migrationPayloadHash: "m", validUntil: 1 });
  await client.getMigrationClaim("c1");
  await client.getSessionStatus({ account: "0xabc", sessionKey: "0x1", target: "0x2", selector: "0x12345678" });
  await client.verifyAttestation({ attestationId: "a1", subjectType: "s", subjectId: "1", payloadHash: "p" });

  assert.equal(seen.length, 7);
  assert.equal(seen.every(([, gameId]) => gameId === GREEN_ROAD_GAME_ID), true);
});

test("unknown Green Road features fail closed", () => {
  assert.throws(() => evaluateGreenRoadAccess({ feature: "unknown", ...guest }), TypeError);
});
