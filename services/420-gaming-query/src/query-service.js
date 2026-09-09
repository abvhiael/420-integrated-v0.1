const REQUIRED = ["games", "profiles", "entitlements", "claims", "attestations"];

function requireAdapter(adapters, name) {
  const adapter = adapters?.[name];
  if (!adapter) throw new Error(`Missing gaming query adapter: ${name}`);
  return adapter;
}

function requireId(name, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} is required`);
  }
  return value;
}

export function createGamingQuery420({ adapters } = {}) {
  for (const name of REQUIRED) requireAdapter(adapters, name);

  return Object.freeze({
    async game(gameId) {
      return requireAdapter(adapters, "games").getGame(requireId("gameId", gameId));
    },

    async profileForGameAccount({ gameId, account }) {
      requireId("gameId", gameId);
      requireId("account", account);
      return requireAdapter(adapters, "profiles").getProfileForGameAccount({ gameId, account });
    },

    async entitlement({ entitlementId, gameId, profileId }) {
      requireId("entitlementId", entitlementId);
      requireId("gameId", gameId);
      requireId("profileId", profileId);
      const value = await requireAdapter(adapters, "entitlements").getEntitlement(entitlementId);
      if (!value || value.gameId !== gameId || value.profileId !== profileId) return null;
      return value;
    },

    async claim({ claimId, gameId, targetAccount }) {
      requireId("claimId", claimId);
      requireId("gameId", gameId);
      requireId("targetAccount", targetAccount);
      const value = await requireAdapter(adapters, "claims").getClaim(claimId);
      if (!value || value.gameId !== gameId || value.targetAccount !== targetAccount) return null;
      return value;
    },

    async attestation({ attestationId, sourceGameId, profileId, subjectType, subjectId }) {
      for (const [name, value] of Object.entries({ attestationId, sourceGameId, profileId, subjectType, subjectId })) {
        requireId(name, value);
      }
      const value = await requireAdapter(adapters, "attestations").getAttestation(attestationId);
      if (!value) return null;
      if (value.sourceGameId !== sourceGameId) return null;
      if (value.profileId !== profileId) return null;
      if (value.subjectType !== subjectType) return null;
      if (value.subjectId !== subjectId) return null;
      return value;
    }
  });
}

export const ForbiddenGamingQueries420 = Object.freeze([
  "wallet-wide-game-history",
  "cross-game-player-activity-feed",
  "enumerate-all-entitlements-for-wallet",
  "enumerate-all-attestations-for-wallet",
  "enumerate-all-claims-for-wallet"
]);
