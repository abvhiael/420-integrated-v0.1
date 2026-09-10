export function createGamingPlayerProfileService420({ clock = () => Date.now(), idFactory = crypto.randomUUID } = {}) {
  const accounts = new Map();
  const profiles = new Map();
  const walletLinks = new Map();
  const migrations = new Map();
  const migrationReplayKeys = new Map();

  function requireText(value, name) {
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} required`);
    return value;
  }

  function accountKey(accountId) { return requireText(accountId, "accountId"); }
  function profileKey(accountId, gameId) { return `${accountKey(accountId)}:${requireText(gameId, "gameId")}`; }
  function migrationReplayKey({ accountId, gameId, guestStateCommitment, migrationPayloadHash }) {
    return [
      accountKey(accountId),
      requireText(gameId, "gameId"),
      requireText(guestStateCommitment, "guestStateCommitment"),
      requireText(migrationPayloadHash, "migrationPayloadHash")
    ].join(":");
  }

  return Object.freeze({
    registerAccount({ accountId = idFactory(), credentialRef }) {
      requireText(accountId, "accountId");
      requireText(credentialRef, "credentialRef");
      if (accounts.has(accountId)) throw new Error("account-exists");
      const account = Object.freeze({ accountId, credentialRef, createdAt: clock() });
      accounts.set(accountId, account);
      return account;
    },

    getAccount(accountId) { return accounts.get(accountKey(accountId)) ?? null; },

    upsertGameProfile({ accountId, gameId, cloudSaveRef, preferences = {} }) {
      if (!accounts.has(accountKey(accountId))) throw new Error("account-not-found");
      requireText(cloudSaveRef, "cloudSaveRef");
      const key = profileKey(accountId, gameId);
      const prior = profiles.get(key);
      const profile = Object.freeze({
        accountId,
        gameId,
        cloudSaveRef,
        preferences: Object.freeze({ ...preferences }),
        createdAt: prior?.createdAt ?? clock(),
        updatedAt: clock()
      });
      profiles.set(key, profile);
      return profile;
    },

    getGameProfile({ accountId, gameId }) { return profiles.get(profileKey(accountId, gameId)) ?? null; },

    linkWallet({ accountId, gameId, walletAccount }) {
      if (!accounts.has(accountKey(accountId))) throw new Error("account-not-found");
      requireText(walletAccount, "walletAccount");
      const key = profileKey(accountId, gameId);
      const current = walletLinks.get(key);
      if (current && current.walletAccount !== walletAccount) throw new Error("wallet-link-conflict");
      const link = Object.freeze({ accountId, gameId, walletAccount, linkedAt: current?.linkedAt ?? clock() });
      walletLinks.set(key, link);
      return link;
    },

    getWalletLink({ accountId, gameId }) { return walletLinks.get(profileKey(accountId, gameId)) ?? null; },

    prepareMigration({ accountId, gameId, guestStateCommitment, migrationPayloadHash }) {
      if (!accounts.has(accountKey(accountId))) throw new Error("account-not-found");
      const link = walletLinks.get(profileKey(accountId, gameId));
      if (!link) throw new Error("wallet-not-linked");

      const replayKey = migrationReplayKey({ accountId, gameId, guestStateCommitment, migrationPayloadHash });
      const existingId = migrationReplayKeys.get(replayKey);
      if (existingId) return migrations.get(existingId);

      const migrationId = idFactory();
      const record = Object.freeze({
        migrationId,
        accountId,
        gameId,
        walletAccount: link.walletAccount,
        guestStateCommitment,
        migrationPayloadHash,
        preparedAt: clock(),
        status: "prepared"
      });
      migrations.set(migrationId, record);
      migrationReplayKeys.set(replayKey, migrationId);
      return record;
    },

    markMigrationClaimIssued({ migrationId, claimId }) {
      const prior = migrations.get(requireText(migrationId, "migrationId"));
      if (!prior) throw new Error("migration-not-found");
      requireText(claimId, "claimId");
      if (prior.status === "claim-issued") {
        if (prior.claimId !== claimId) throw new Error("migration-state-invalid");
        return prior;
      }
      if (prior.status !== "prepared") throw new Error("migration-state-invalid");
      const next = Object.freeze({ ...prior, claimId, status: "claim-issued", claimIssuedAt: clock() });
      migrations.set(migrationId, next);
      return next;
    },

    markMigrationConsumed({ migrationId, claimId }) {
      const prior = migrations.get(requireText(migrationId, "migrationId"));
      if (!prior) throw new Error("migration-not-found");
      requireText(claimId, "claimId");
      if (prior.status === "consumed") {
        if (prior.claimId !== claimId) throw new Error("migration-state-invalid");
        return prior;
      }
      if (prior.status !== "claim-issued" || prior.claimId !== claimId) throw new Error("migration-state-invalid");
      const next = Object.freeze({ ...prior, status: "consumed", consumedAt: clock() });
      migrations.set(migrationId, next);
      return next;
    },

    getMigration(migrationId) { return migrations.get(requireText(migrationId, "migrationId")) ?? null; }
  });
}
