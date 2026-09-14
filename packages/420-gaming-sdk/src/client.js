import { AccessRequirement, derivePlayerAccessState, evaluateAccessRequirement } from "./access-state.js";

function requireAdapter(adapters, name) {
  const fn = adapters?.[name];
  if (typeof fn !== "function") throw new TypeError(`Missing 420 Gaming SDK adapter: ${name}`);
  return fn;
}

function scopedResult(gameId, value) {
  if (value == null) return value;
  if (typeof value === "object" && "gameId" in value && value.gameId !== gameId) return null;
  return value;
}

export function createGamingClient420({ gameId, adapters = {} } = {}) {
  if (!gameId) throw new TypeError("gameId is required");

  async function callScoped(name, args) {
    const value = await requireAdapter(adapters, name)({ gameId, ...args });
    return scopedResult(gameId, value);
  }

  return Object.freeze({
    gameId,

    getPlayerState(input = {}) {
      return derivePlayerAccessState(input);
    },

    canAccess({ requirement = AccessRequirement.CORE, ...state } = {}) {
      return evaluateAccessRequirement({ requirement, ...state });
    },

    async getProfile(account) {
      return callScoped("getProfile", { account });
    },

    async ensureProfile(account) {
      return callScoped("ensureProfile", { account });
    },

    async getEntitlement({ profileId, entitlementId, entitlementType, contentId }) {
      return callScoped("getEntitlement", {
        profileId,
        entitlementId,
        entitlementType,
        contentId
      });
    },

    async prepareMigration({ targetAccount, guestStateCommitment, migrationPayloadHash, validUntil }) {
      return callScoped("prepareMigration", {
        targetAccount,
        guestStateCommitment,
        migrationPayloadHash,
        validUntil
      });
    },

    async getMigrationClaim(claimId) {
      return callScoped("getMigrationClaim", { claimId });
    },

    async getSessionStatus({ account, sessionKey, target, selector }) {
      return callScoped("getSessionStatus", {
        account,
        sessionKey,
        target,
        selector
      });
    },

    async verifyAttestation({ attestationId, subjectType, subjectId, payloadHash }) {
      return callScoped("verifyAttestation", {
        attestationId,
        subjectType,
        subjectId,
        payloadHash
      });
    }
  });
}
