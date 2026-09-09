export const GamingAdapterMethod = Object.freeze({
  GET_PROFILE: "getProfile",
  ENSURE_PROFILE: "ensureProfile",
  GET_ENTITLEMENT: "getEntitlement",
  PREPARE_MIGRATION: "prepareMigration",
  GET_MIGRATION_CLAIM: "getMigrationClaim",
  GET_SESSION_STATUS: "getSessionStatus",
  VERIFY_ATTESTATION: "verifyAttestation"
});

export function validateGamingAdapters(adapters = {}, required = Object.values(GamingAdapterMethod)) {
  const missing = required.filter((name) => typeof adapters[name] !== "function");
  return Object.freeze({ valid: missing.length === 0, missing });
}
