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

test("migration claim issuance is one-way and replay safe", () => {
  const service = fixture();
  service.registerAccount({ accountId: "acct-1", credentialRef: "credential:opaque" });
  service.linkWallet({ accountId: "acct-1", gameId: "game-a", walletAccount: "0xabc" });
  const migration = service.prepareMigration({ accountId: "acct-1", gameId: "game-a", guestStateCommitment: "0xguest", migrationPayloadHash: "0xpayload" });
  const issued = service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-1" });
  assert.equal(issued.status, "claim-issued");
  assert.throws(() => service.markMigrationClaimIssued({ migrationId: migration.migrationId, claimId: "claim-2" }), /migration-state-invalid/);
});
