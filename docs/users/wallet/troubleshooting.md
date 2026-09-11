---
title: Troubleshoot 420 Wallet
audience:
  - user
category: troubleshooting
status: development
version: current
---

# Troubleshoot 420 Wallet

Use this page to diagnose common wallet problems without exposing private signing material.

## Wallet will not connect

Check:

1. that the qualified wallet or injected signing provider is installed/available;
2. that the wallet is unlocked;
3. that the site is running in a supported browser/security context;
4. that you approved the connection request;
5. that the selected network matches the intended 420 Integrated network.

Reloading the page may clear a stale frontend state, but it must not be used to bypass an account or authorization warning.

## Wrong network or chain mismatch

Do not approve transactions until the wallet and application agree on the intended 420 Integrated network.

Use the wallet's qualified network configuration. Avoid adding an unknown RPC endpoint supplied by an untrusted application.

If switching networks does not clear the mismatch, disconnect the application, reopen the qualified wallet, and verify network configuration independently.

## SmartAccount420 cannot be discovered

Possible reasons include:

- the connected controller does not have the expected deployed SmartAccount420;
- you connected the wrong controller address;
- you are acting as a recovery authority rather than owner/controller;
- RPC state is unavailable or stale;
- the application is pointed at the wrong network.

For recovery-authority operations, enter the deployed SmartAccount420 address directly when the wallet instructs you to do so.

## Transaction remains pending

Check the transaction hash in Wallet/Explorer and verify:

- network;
- sender;
- nonce;
- available `$420` for value plus gas;
- RPC health;
- whether an earlier transaction from the same nonce lane is still unresolved.

Do not sign repeated replacements unless the wallet explicitly supports the replacement flow and explains its effect.

## Transaction failed

A failed included transaction can still consume gas.

Review the receipt and any surfaced revert/error information. Common causes include changed contract state, insufficient authorization, expired deadlines, invalid calldata, insufficient balance, or a permission/session that is no longer valid.

Re-read canonical state before retrying.

## Simulation failed

Stop and inspect the reason. Do not bypass simulation simply to force submission.

A simulation failure may indicate:

- the call would revert;
- the active account lacks authority;
- target/value/calldata is invalid;
- a deadline expired;
- state changed;
- the passkey/session/capability authorization is stale.

## Passkey unavailable

The current passkey path requires:

- runtime passkey feature enabled;
- supported WebAuthn browser/device APIs;
- a connected controlling wallet;
- a deployed/discoverable SmartAccount420;
- a valid binding for the current authorization epoch.

If the wallet reports a stale binding, use the explicit re-enrollment path. Do not try to copy or export passkey private material.

## Passkey works on one session but not another

The current web wallet keeps its public passkey binding metadata in session memory. A new browser session can therefore require explicit enrollment/re-enrollment or restoration supported by a future qualified client.

The private credential remains with the platform authenticator; session-memory behavior refers to the wallet's binding metadata, not private-key export.

## Permission or session stopped working

Check whether:

- it expired;
- it was revoked;
- its spending/target scope does not cover the requested action;
- the authorization epoch changed;
- the application or destination was deprecated/revoked;
- the wallet is connected to a different account/network.

Create a new narrow authorization rather than widening an old one without review.

## Recovery action is disabled

The recovery UI enables actions based on canonical role/state.

Examples:

- only the owner can set/update recovery authority;
- only the configured recovery authority can propose/finalize recovery;
- only the current owner can cancel a pending recovery;
- finalization remains disabled until the canonical timelock expires;
- a recovery authority may need to enter the SmartAccount420 address directly.

## Recovery countdown looks wrong

Refresh canonical account state and verify network/time assumptions. The actual executable recovery time comes from SmartAccount420 state; a browser countdown is only a presentation of that state.

Never use a modified local clock or browser state to infer that recovery can be finalized early.

## Balance or activity looks stale

Wallet/Explorer/Indexer views are derived from chain data and can lag during RPC/indexing issues or reorganizations.

Compare:

- the transaction hash;
- canonical block status;
- safe/finalized state;
- another qualified read endpoint if available.

Do not assume a stale UI has changed canonical ownership or balance state.

## A dApp keeps asking for approvals

Inspect active permissions/sessions. The dApp may not have the capability it expects, or its authorization may have expired/staled.

Do not grant unlimited authority solely to stop repeated prompts. Use a scoped session/capability appropriate to the task.

## I approved something suspicious

Immediately:

1. disconnect the application;
2. inspect recent transactions;
3. revoke suspicious capabilities/sessions;
4. inspect owner/operator/recovery state;
5. move to a trusted device if compromise is suspected;
6. use canonical recovery if owner authority is no longer trustworthy and valid recovery is configured.

## What to include in a support report

Safe diagnostic information includes:

- wallet client/version/build;
- operating system/browser version;
- network name;
- public account or SmartAccount420 address;
- transaction hash;
- exact error message;
- steps that reproduce the problem;
- whether the transaction is pending, included, safe, or finalized.

Never include:

- seed phrase;
- private key;
- passkey private material;
- raw signing secrets;
- recovery secret;
- authentication recovery codes;
- exported secure-store contents.

## Related documentation

- [Wallet onboarding](index.md)
- [Send and receive `$420`](send-receive-and-activity.md)
- [Permissions and sessions](permissions-and-sessions.md)
- [Recovery and device safety](recovery-and-device-safety.md)
