import test from "node:test";
import assert from "node:assert/strict";
import {
  SMOKE_CHROME_GAME_ID,
  SmokeChromeFeature,
  createSmokeChromeGamingClient,
  evaluateSmokeChromeAccess
} from "../src/access.js";

test("core matches and deck building remain wallet-free", () => {
  for (const feature of [SmokeChromeFeature.CORE_MATCH, SmokeChromeFeature.DECK_BUILDING]) {
    const access = evaluateSmokeChromeAccess({ feature, registered: false, walletLinked: false, walletConnected: false });
    assert.equal(access.allowed, true);
    assert.equal(access.prompt, "none");
  }
});

test("cloud save requires registration but not wallet", () => {
  const guest = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CLOUD_SAVE, registered: false, walletLinked: false, walletConnected: false });
  assert.equal(guest.allowed, false);
  assert.equal(guest.prompt, "register");
  const registered = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CLOUD_SAVE, registered: true, walletLinked: false, walletConnected: false });
  assert.equal(registered.allowed, true);
});

test("ownership and market features use deliberate wallet boundaries", () => {
  for (const feature of [SmokeChromeFeature.OWNED_EDITION, SmokeChromeFeature.COLLECTIBLE, SmokeChromeFeature.MARKETPLACE, SmokeChromeFeature.TOURNAMENT_PRIZE, SmokeChromeFeature.CROSS_GAME_PRESTIGE]) {
    const unlinked = evaluateSmokeChromeAccess({ feature, registered: true, walletLinked: false, walletConnected: false });
    assert.equal(unlinked.allowed, false);
    assert.equal(unlinked.prompt, "link-wallet");
    const disconnected = evaluateSmokeChromeAccess({ feature, registered: true, walletLinked: true, walletConnected: false });
    assert.equal(disconnected.allowed, false);
    assert.equal(disconnected.prompt, "connect-wallet");
    const connected = evaluateSmokeChromeAccess({ feature, registered: true, walletLinked: true, walletConnected: true });
    assert.equal(connected.allowed, true);
  }
});

test("shared client scopes adapters to Smoke & Chrome", async () => {
  const seen = [];
  const adapters = Object.fromEntries([
    "getProfile", "ensureProfile", "getEntitlement", "prepareMigration", "getMigrationClaim", "getSessionStatus", "verifyAttestation"
  ].map(name => [name, async input => { seen.push(input.gameId); return input; }]));
  const client = createSmokeChromeGamingClient(adapters);
  await client.getProfile("0x1");
  await client.ensureProfile("0x1");
  await client.getEntitlement({ profileId: "p", entitlementId: "e" });
  await client.prepareMigration({ targetAccount: "0x1", guestStateCommitment: "g", migrationPayloadHash: "m", validUntil: 1 });
  await client.getMigrationClaim("c");
  await client.getSessionStatus({ account: "0x1", sessionKey: "0x2", target: "0x3", selector: "0x12345678" });
  await client.verifyAttestation({ attestationId: "a", subjectType: "t", subjectId: "s", payloadHash: "h" });
  assert.deepEqual(seen, Array(7).fill(SMOKE_CHROME_GAME_ID));
});

test("wallet linkage alone never changes match or deck power", () => {
  const guestMatch = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CORE_MATCH, registered: false, walletLinked: false, walletConnected: false });
  const walletMatch = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.CORE_MATCH, registered: true, walletLinked: true, walletConnected: true });
  assert.equal(guestMatch.allowed, walletMatch.allowed);
  const guestDeck = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.DECK_BUILDING, registered: false, walletLinked: false, walletConnected: false });
  const walletDeck = evaluateSmokeChromeAccess({ feature: SmokeChromeFeature.DECK_BUILDING, registered: true, walletLinked: true, walletConnected: true });
  assert.equal(guestDeck.allowed, walletDeck.allowed);
});
