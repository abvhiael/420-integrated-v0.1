import test from "node:test";
import assert from "node:assert/strict";
import { createGamingQuery420, ForbiddenGamingQueries420 } from "../src/query-service.js";

const gameId = "game:hc";
const account = "0xabc";
const profileId = "profile:1";

function service(overrides = {}) {
  const adapters = {
    games: { async getGame(id) { return { gameId: id, active: true }; } },
    profiles: { async getProfileForGameAccount(input) { return { ...input, profileId }; } },
    entitlements: { async getEntitlement(id) { return { entitlementId: id, gameId, profileId }; } },
    claims: { async getClaim(id) { return { claimId: id, gameId, targetAccount: account }; } },
    attestations: { async getAttestation(id) { return { attestationId: id, sourceGameId: gameId, profileId, subjectType: "cup", subjectId: "2026" }; } },
    ...overrides
  };
  return createGamingQuery420({ adapters });
}

test("resolves only game-scoped profile lookup", async () => {
  const result = await service().profileForGameAccount({ gameId, account });
  assert.equal(result.profileId, profileId);
  assert.equal(result.gameId, gameId);
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

test("forbidden query catalogue excludes global player enumeration", () => {
  assert.ok(ForbiddenGamingQueries420.includes("wallet-wide-game-history"));
  assert.ok(ForbiddenGamingQueries420.includes("cross-game-player-activity-feed"));
});
