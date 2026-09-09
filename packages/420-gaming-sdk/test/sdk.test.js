import test from "node:test";
import assert from "node:assert/strict";
import {
  AccessRequirement,
  PlayerAccessState,
  PromptKind,
  createGamingClient420,
  derivePlayerAccessState,
  evaluateAccessRequirement
} from "../src/index.js";

test("derives guest registered and wallet-linked states", () => {
  assert.equal(derivePlayerAccessState(), PlayerAccessState.GUEST);
  assert.equal(derivePlayerAccessState({ registered: true }), PlayerAccessState.REGISTERED);
  assert.equal(derivePlayerAccessState({ registered: true, walletLinked: true }), PlayerAccessState.WALLET_LINKED);
});

test("core play never prompts for registration or wallet", () => {
  const decision = evaluateAccessRequirement({ requirement: AccessRequirement.CORE });
  assert.equal(decision.allowed, true);
  assert.equal(decision.prompt, PromptKind.NONE);
  assert.equal(decision.optional, false);
});

test("registered-only feature prompts guests to register", () => {
  const decision = evaluateAccessRequirement({ requirement: AccessRequirement.REGISTERED });
  assert.equal(decision.allowed, false);
  assert.equal(decision.prompt, PromptKind.REGISTER);
});

test("wallet feature links then reconnects only at feature boundary", () => {
  let decision = evaluateAccessRequirement({ requirement: AccessRequirement.WALLET });
  assert.equal(decision.prompt, PromptKind.LINK_WALLET);

  decision = evaluateAccessRequirement({ requirement: AccessRequirement.WALLET, walletLinked: true });
  assert.equal(decision.prompt, PromptKind.CONNECT_WALLET);

  decision = evaluateAccessRequirement({ requirement: AccessRequirement.WALLET, walletLinked: true, walletConnected: true });
  assert.equal(decision.allowed, true);
  assert.equal(decision.prompt, PromptKind.NONE);
});

test("client scopes every adapter call to one game id", async () => {
  const calls = [];
  const capture = (name) => async (args) => { calls.push([name, args]); return args; };
  const client = createGamingClient420({
    gameId: "game:high-country",
    adapters: {
      getProfile: capture("getProfile"),
      ensureProfile: capture("ensureProfile"),
      getEntitlement: capture("getEntitlement"),
      prepareMigration: capture("prepareMigration"),
      getMigrationClaim: capture("getMigrationClaim"),
      getSessionStatus: capture("getSessionStatus"),
      verifyAttestation: capture("verifyAttestation")
    }
  });

  await client.getProfile("0xabc");
  await client.ensureProfile("0xabc");
  await client.getEntitlement({ profileId: "p1", entitlementId: "e1" });
  await client.prepareMigration({ targetAccount: "0xabc", guestStateCommitment: "g", migrationPayloadHash: "m" });
  await client.getMigrationClaim("c1");
  await client.getSessionStatus({ account: "0xabc", sessionKey: "0xdef", target: "0x123", selector: "0xabcdef01" });
  await client.verifyAttestation({ attestationId: "a1", subjectType: "cup", subjectId: "2026", payloadHash: "h" });

  assert.equal(calls.length, 7);
  for (const [, args] of calls) assert.equal(args.gameId, "game:high-country");
});

test("missing adapters fail closed", async () => {
  const client = createGamingClient420({ gameId: "game:test" });
  await assert.rejects(() => client.getProfile("0xabc"), /Missing 420 Gaming SDK adapter/);
});
