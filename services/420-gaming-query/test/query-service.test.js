import test from "node:test";
import assert from "node:assert/strict";
import { createGamingQuery420, ForbiddenGamingQueries420 } from "../src/query-service.js";

const gameId = "game:hc";
const account = "0xabc";
const profileId = "profile:1";
const provenance = Object.freeze({ blockNumber: 420, blockHash: "0x420", finalized: true });

function service(overrides = {}, options = {}) {
  const adapters = {
    games: { async getGame(id) { return { gameId: id, active: true, provenance }; } },
    profiles: { async getProfileForGameAccount(input) { return { ...input, profileId, provenance }; } },
    entitlements: { async getEntitlement(id) { return { entitlementId: id, gameId, profileId, provenance }; } },
    claims: { async getClaim(id) { return { claimId: id, gameId, targetAccount: account, provenance }; } },
    attestations: { async getAttestation(id) { return { attestationId: id, sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026", provenance }; } },
    ...overrides
  };
  return createGamingQuery420({ adapters, ...options });
}

function finalizedContext(overrides = {}) {
  return {
    expectedChainId: 420,
    rpcChainId: 420,
    txStatus: "success",
    canonicalBlockHash: "0x420",
    canonicalHeadNumber: 423,
    finalizedHeadNumber: 423,
    indexerHeadNumber: 423,
    confirmationsRequired: 3,
    ...overrides
  };
}

test("resolves only game-scoped profile lookup", async () => {
  const result = await service().profileForGameAccount({ gameId, account });
  assert.equal(result.profileId, profileId);
  assert.equal(result.gameId, gameId);
});

test("profile lookup fails closed on adapter scope mismatch", async () => {
  const query = service({ profiles: { async getProfileForGameAccount() { return { gameId: "game:other", account, profileId, provenance }; } } });
  assert.equal(await query.profileForGameAccount({ gameId, account }), null);
});

test("entitlement lookup fails closed on wrong profile", async () => {
  const result = await service().entitlement({ entitlementId: "e1", gameId, profileId: "other" });
  assert.equal(result, null);
});

test("claim lookup fails closed on wrong target account", async () => {
  const result = await service().claim({ claimId: "c1", gameId, targetAccount: "0xdef" });
  assert.equal(result, null);
});

test("attestation requires exact source/profile/subject scope", async () => {
  const ok = await service().attestation({ attestationId: "a1", sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026" });
  assert.equal(ok.attestationId, "a1");
  const wrong = await service().attestation({ attestationId: "a1", sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2025" });
  assert.equal(wrong, null);
});

test("missing provenance fails closed", async () => {
  const query = service({ entitlements: { async getEntitlement(id) { return { entitlementId: id, gameId, profileId }; } } });
  assert.equal(await query.entitlement({ entitlementId: "e1", gameId, profileId }), null);
});

test("high-risk indexed reads require finalized provenance", async () => {
  const pending = { blockNumber: 421, blockHash: "0x421", finalized: false };
  const query = service({ claims: { async getClaim(id) { return { claimId: id, gameId, targetAccount: account, provenance: pending }; } } });
  assert.equal(await query.claim({ claimId: "c1", gameId, targetAccount: account }), null);
});

test("canonical revalidator rejects reorged block hash", async () => {
  const query = service({}, {
    canonicalRevalidator: async () => ({ canonical: true, blockNumber: 420, blockHash: "0xdead", finalized: true })
  });
  assert.equal(await query.entitlement({ entitlementId: "e1", gameId, profileId }), null);
});

test("canonical revalidator rejects non-canonical state", async () => {
  const query = service({}, {
    canonicalRevalidator: async () => ({ canonical: false, blockNumber: 420, blockHash: "0x420", finalized: true })
  });
  assert.equal(await query.attestation({ attestationId: "a1", sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026" }), null);
});

test("canonical finalized high-risk read is accepted", async () => {
  const query = service({}, {
    canonicalRevalidator: async () => ({ canonical: true, blockNumber: 420, blockHash: "0x420", finalized: true })
  });
  const value = await query.entitlement({ entitlementId: "e1", gameId, profileId });
  assert.equal(value.entitlementId, "e1");
});

test("high-risk entitlement requires live finality when finalityResolver is configured", async () => {
  const query = service({}, { finalityResolver: async () => finalizedContext() });
  const value = await query.entitlement({ entitlementId: "e1", gameId, profileId });
  assert.equal(value.entitlementId, "e1");
});

test("reorged entitlement is removed from the consumable query path", async () => {
  const query = service({}, { finalityResolver: async () => finalizedContext({ canonicalBlockHash: "0xdead" }) });
  assert.equal(await query.entitlement({ entitlementId: "e1", gameId, profileId }), null);
});

test("RPC failure and chain mismatch fail closed for claims", async () => {
  const rpcDown = service({}, { finalityResolver: async () => finalizedContext({ rpcChainId: undefined }) });
  assert.equal(await rpcDown.claim({ claimId: "c1", gameId, targetAccount: account }), null);

  const wrongChain = service({}, { finalityResolver: async () => finalizedContext({ rpcChainId: 1 }) });
  assert.equal(await wrongChain.claim({ claimId: "c1", gameId, targetAccount: account }), null);
});

test("indexer ahead or behind RPC suppresses attestation consumption", async () => {
  const behind = service({}, { finalityResolver: async () => finalizedContext({ indexerHeadNumber: 422 }) });
  assert.equal(await behind.attestation({ attestationId: "a1", sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026" }), null);

  const ahead = service({}, { finalityResolver: async () => finalizedContext({ indexerHeadNumber: 424 }) });
  assert.equal(await ahead.attestation({ attestationId: "a1", sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026" }), null);
});

test("insufficient confirmations keep high-risk reads pending", async () => {
  const query = service({}, { finalityResolver: async () => finalizedContext({ finalizedHeadNumber: 420, confirmationsRequired: 3 }) });
  assert.equal(await query.entitlement({ entitlementId: "e1", gameId, profileId }), null);
});

test("finality resolver exceptions fail closed instead of leaking optimistic state", async () => {
  const query = service({}, { finalityResolver: async () => { throw new Error("rpc-timeout"); } });
  assert.equal(await query.claim({ claimId: "c1", gameId, targetAccount: account }), null);
});

test("standard-risk game/profile reads remain available without live finality hook", async () => {
  let calls = 0;
  const query = service({}, { finalityResolver: async () => { calls += 1; throw new Error("should-not-run"); } });
  assert.equal((await query.game(gameId)).gameId, gameId);
  assert.equal((await query.profileForGameAccount({ gameId, account })).profileId, profileId);
  assert.equal(calls, 0);
});

test("forbidden query catalogue excludes global player enumeration", () => {
  assert.ok(ForbiddenGamingQueries420.includes("wallet-wide-game-history"));
  assert.ok(ForbiddenGamingQueries420.includes("cross-game-player-activity-feed"));
  assert.equal("walletHistory" in service(), false);
  assert.equal("allEntitlementsForWallet" in service(), false);
});
