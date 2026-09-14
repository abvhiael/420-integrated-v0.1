import test from "node:test";
import assert from "node:assert/strict";
import { createGamingPlayerProfileService420 } from "../src/service.js";

function fixture() {
  let now = 1000;
  let id = 0;
  return createGamingPlayerProfileService420({ clock: () => ++now, idFactory: () => `id-${++id}` });
}

test("registered account can maintain a game-scoped cloud profile without wallet", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  const profile = service.upsertGameProfile({ accountId: "acct-1", gameId: "game-a", cloudSaveRef: "save:opaque" });
  assert.equal(profile.gameId, "game-a");
  assert.equal(service.getWalletLink({ accountId: "acct-1", gameId: "game-a" }), null);
});

test("wallet links are isolated per account and game", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  assert.equal(service.getWalletLink({ accountId: "acct-1", gameId: "game-a" }).walletAccount, "0xabc");
  assert.equal(service.getWalletLink({ accountId: "acct-1", gameId: "game-b" }), null);
});

test("wallet relinking to another account fails closed", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  assert.throws(() => service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xdef" }), /wallet-link-conflict/);
});

test("migration preparation requires a wallet link and stores only commitments", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  assert.throws(() => service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" }), /wallet-not-linked/);
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  const migration = service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });
  assert.equal(migration.status, "prepared");
  assert.equal("rawGuestSave" in migration, false);
  assert.equal("email" in migration, false);
});

test("duplicate migration preparation is idempotent for the same account game and payload", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });

  const first = service.prepareMigration({
    accountId: "acct-1",
    gameId: "game-a",
    guestStateCommitment: "0xguest",
    migrationPayloadHash: "0xpayload"
  });
  const replay = service.prepareMigration({
    accountId: "acct-1",
    gameId: "game-a",
    guestStateCommitment: "0xguest",
    migrationPayloadHash: "0xpayload"
  });

  assert.equal(replay.migrationId, first.migrationId);
  assert.equal(replay.preparedAt, first.preparedAt);
});

test("migration replay key remains game scoped", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-b", walletAccount: "0xabc" });

  const a = service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });
  const b = service.prepareMigration({ accountId: "acct-1", gameId: "game-b", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });

  assert.notEqual(a.migrationId, b.migrationId);
});

test("migration claim issuance is idempotent for the canonical claim and rejects alternate replay", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  const migration = service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });
  const issued = service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-1" });
  const recovered = service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-1" });
  assert.equal(issued.status, "claim-issued");
  assert.equal(recovered, issued);
  assert.throws(() => service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-2" }), /migration-state-invalid/);
});

test("migration consumption is one-way and safely recoverable after duplicate acknowledgement", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  const migration = service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });
  service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-1" });

  const consumed = service.markMigrationConsumed({ migrationId: migration.migrationId, claimId: "claim-1" });
  const replay = service.markMigrationConsumed({ migrationId: migration.migrationId, claimId: "claim-1" });

  assert.equal(consumed.status, "consumed");
  assert.equal(replay, consumed);
  assert.throws(() => service.markMigrationConsumed({ migrationId: migration.migrationId, claimId: "claim-2" }), /migration-state-invalid/);
  assert.throws(() => service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-1" }), /migration-state-invalid/);
});
