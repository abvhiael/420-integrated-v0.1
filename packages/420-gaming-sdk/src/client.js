import { AccessRequirement, derivePlayerAccessState, evaluateAccessRequirement } from "./access-state.js";

function requireAdapter(adapters, name) {
  const fn = adapters?.[name];
  if (typeof fn !== "function") throw new TypeError(`Missing 420 Gaming SDK adapter: ${name}`);
  return fn;
}

export function createGamingClient420({ gameId, adapters = {} } = {}) {
  if (!gameId) throw new TypeError("gameId is required");

  return Object.freeze({
    gameId,

    getPlayerState(input = {}) {
      return derivePlayerAccessState(input);
    },

    canAccess({ requirement = AccessRequirement.CORE, ...state } = {}) {
      return evaluateAccessRequirement({ requirement, ...state });
    },

    async getProfile(account) {
      return requireAdapter(adapters, "getProfile")({ gameId, account });
    },

    async ensureProfile(account) {
      return requireAdapter(adapters, "ensureProfile")({ gameId, account });
    },

    async getEntitlement({ profileId, entitlementId, entitlementType, contentId }) {
      return requireAdapter(adapters, "getEntitlement")({
        gameId,
        profileId,
        entitlementId,
        entitlementType,
        contentId
      });
    },

    async prepareMigration({ targetAccount, guestStateCommitment, migrationPayloadHash, validUntil }) {
      return requireAdapter(adapters, "prepareMigration")({
        gameId,
        targetAccount,
        guestStateCommitment,
        migrationPayloadHash,
        validUntil
      });
    },

    async getMigrationClaim(claimId) {
      return requireAdapter(adapters, "getMigrationClaim")({ gameId, claimId });
    },

    async getSessionStatus({ account, sessionKey, target, selector }) {
      return requireAdapter(adapters, "getSessionStatus")({
        gameId,
        account,
        sessionKey,
        target,
        selector
      });
    },

    async verifyAttestation({ attestationId, subjectType, subjectId, payloadHash }) {
      return requireAdapter(adapters, "verifyAttestation")({
        gameId,
        attestationId,
        subjectType,
        subjectId,
        payloadHash
      });
    }
  });
}
