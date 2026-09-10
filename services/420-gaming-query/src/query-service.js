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

function normalizeProvenance(value) {
  const provenance = value?.provenance;
  if (!provenance || typeof provenance !== "object") return null;
  const { blockNumber, blockHash, finalized } = provenance;
  if (!Number.isInteger(blockNumber) || blockNumber < 0) return null;
  if (typeof blockHash !== "string" || blockHash.length === 0) return null;
  if (typeof finalized !== "boolean") return null;
  return { blockNumber, blockHash, finalized };
}

async function validateIndexedValue({ value, revalidator, risk = "standard" }) {
  if (!value) return null;

  const provenance = normalizeProvenance(value);
  if (!provenance) return null;

  if (risk === "high" && !provenance.finalized) return null;
  if (!revalidator) return value;

  const verdict = await revalidator({ provenance, value, risk });
  if (!verdict || verdict.canonical !== true) return null;
  if (verdict.blockHash && verdict.blockHash !== provenance.blockHash) return null;
  if (Number.isInteger(verdict.blockNumber) && verdict.blockNumber !== provenance.blockNumber) return null;
  if (risk === "high" && verdict.finalized !== true) return null;

  return value;
}

export function createGamingQuery420({ adapters, canonicalRevalidator } = {}) {
  for (const name of REQUIRED) requireAdapter(adapters, name);
  if (canonicalRevalidator !== undefined && typeof canonicalRevalidator !== "function") {
    throw new TypeError("canonicalRevalidator must be a function");
  }

  return Object.freeze({
    async game(gameId) {
      const value = await requireAdapter(adapters, "games").getGame(requireId("gameId", gameId));
      return validateIndexedValue({ value, revalidator: canonicalRevalidator, risk: "standard" });
    },

    async profileForGameAccount({ gameId, account }) {
      requireId("gameId", gameId);
      requireId("account", account);
      const value = await requireAdapter(adapters, "profiles").getProfileForGameAccount({ gameId, account });
      if (!value || value.gameId !== gameId || value.account !== account) return null;
      return validateIndexedValue({ value, revalidator: canonicalRevalidator, risk: "standard" });
    },

    async entitlement({ entitlementId, gameId, profileId }) {
      requireId("entitlementId", entitlementId);
      requireId("gameId", gameId);
      requireId("profileId", profileId);
      const value = await requireAdapter(adapters, "entitlements").getEntitlement(entitlementId);
      if (!value || value.gameId !== gameId || value.profileId !== profileId) return null;
      return validateIndexedValue({ value, revalidator: canonicalRevalidator, risk: "high" });
    },

    async claim({ claimId, gameId, targetAccount }) {
      requireId("claimId", claimId);
      requireId("gameId", gameId);
      requireId("targetAccount", targetAccount);
      const value = await requireAdapter(adapters, "claims").getClaim(claimId);
      if (!value || value.gameId !== gameId || value.targetAccount !== targetAccount) return null;
      return validateIndexedValue({ value, revalidator: canonicalRevalidator, risk: "high" });
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
      return validateIndexedValue({ value, revalidator: canonicalRevalidator, risk: "high" });
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
