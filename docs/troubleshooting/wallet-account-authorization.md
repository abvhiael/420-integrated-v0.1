---
title: Wallet, account and authorization troubleshooting registry
audience:
  - user
  - developer
category: troubleshooting
status: current
version: current
---

# Wallet, account and authorization troubleshooting registry

Use these stable DOC-11 identifiers when a 420 Wallet, SmartAccount420, capability, session, passkey, signing or recovery symptom needs a predictable support reference. These are documentation identifiers; they do not replace runtime error codes or contract errors.

For detailed Wallet task procedures, use the canonical [Wallet troubleshooting guide](../users/wallet/troubleshooting.md). Exact machine-generated errors/selectors belong to DOC-10 generated reference.

## TRB-WALLET-001 — Wallet will not connect

- **Audience:** user, developer
- **Surface:** 420 Wallet / dApp connection
- **Severity:** blocked
- **Symptom:** the dApp cannot establish a Wallet connection or the connection request never reaches a usable connected state.
- **Authority source:** qualified Wallet connection state plus the intended application's verified origin and current network configuration.
- **Likely causes:** Wallet unavailable or locked; request rejected; unsupported browser/security context; stale frontend connection state; wrong network; wrong connected account.
- **Diagnostic evidence:** Wallet client/version, browser/OS, application origin, network name/chain ID, public connected address, exact non-secret error text.
- **Retry safety:** safe for connection-only retries; do not repeat any signing request merely because connection failed.
- **Recovery:** unlock/open the qualified Wallet; verify the application origin; verify intended network; reconnect; reload only to clear stale presentation state; do not bypass account/network warnings.
- **Escalation:** stop if the application requests unexpected signing, secret material or an unknown RPC/network configuration.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#wallet-will-not-connect), [Wallet onboarding](../users/wallet/index.md).

## TRB-WALLET-002 — Wallet and application are on different networks

- **Audience:** user, developer
- **Surface:** Wallet network selection / dApp network detection
- **Severity:** value-risk
- **Symptom:** the Wallet and application report different chain IDs or network names, or a transaction request targets an unexpected network.
- **Authority source:** qualified network manifest/chain identity and canonical RPC chain ID.
- **Likely causes:** stale dApp network state; Wallet on another 420 environment; untrusted custom RPC; application misconfiguration.
- **Diagnostic evidence:** expected environment, Wallet chain ID, dApp chain ID, RPC `eth_chainId`, public endpoint identity.
- **Retry safety:** unsafe for state-changing actions until network identity matches.
- **Recovery:** stop signing; verify qualified network settings independently; switch to the intended network; disconnect/reconnect if the application remains stale; reject unknown custom RPC instructions.
- **Escalation:** stop if the requested chain cannot be matched to approved network documentation.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#wrong-network-or-chain-mismatch), [Developer networks and RPC](../developers/networks-testnet-rpc.md).

## TRB-WALLET-003 — SmartAccount420 cannot be discovered

- **Audience:** user, developer
- **Surface:** SmartAccount420 discovery
- **Severity:** blocked
- **Symptom:** the Wallet cannot find the expected SmartAccount420 for the connected controller.
- **Authority source:** canonical chain state, qualified SmartAccountFactory420/Registry discovery and the connected controller address.
- **Likely causes:** wrong controller; wrong network; account not deployed; RPC unavailable/stale; recovery authority connected instead of owner/controller.
- **Diagnostic evidence:** network/chain ID, public controller address, expected SmartAccount420 address if known, canonical code/account state, Wallet build.
- **Retry safety:** safe for read/discovery retries; unsafe to deploy or create a replacement account solely to make discovery succeed without confirming canonical state.
- **Recovery:** verify network and controller; re-read canonical discovery state; use the deployed SmartAccount420 address directly where the recovery flow explicitly requires it.
- **Escalation:** stop before creating/redeploying anything if account existence is ambiguous.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#smartaccount420-cannot-be-discovered), [Wallet developer integration](../developers/wallet-smart-account-capabilities.md).

## TRB-WALLET-004 — Permission or session stopped working

- **Audience:** user, developer
- **Surface:** capability/session authorization
- **Severity:** blocked
- **Symptom:** an action that previously worked is rejected for missing/expired authority or the dApp repeatedly requests authorization.
- **Authority source:** canonical SmartAccount420 capability/session state and current authorization epoch.
- **Likely causes:** expiry; revocation; target/spend scope mismatch; authorization epoch change; destination deprecated/revoked; different account/network.
- **Diagnostic evidence:** public account, network, capability/session identifier if public, requested target/value/scope, current authorization epoch, exact non-secret rejection.
- **Retry safety:** conditional; first confirm whether the authorization is still valid and whether the requested action fits its scope.
- **Recovery:** inspect active permissions; create a new narrow authorization if needed; do not widen an old authorization solely to suppress repeated prompts.
- **Escalation:** stop if the dApp requests broader authority than the task requires.
- **Related:** [Permissions and sessions](../users/wallet/permissions-and-sessions.md), [Wallet troubleshooting](../users/wallet/troubleshooting.md#permission-or-session-stopped-working).

## TRB-WALLET-005 — Passkey unavailable or binding is stale

- **Audience:** user, developer
- **Surface:** Wallet passkey/WebAuthn authorization
- **Severity:** blocked
- **Symptom:** the passkey option is unavailable, fails binding validation, or works in one session but not another.
- **Authority source:** canonical SmartAccount420 authorization epoch and qualified Wallet passkey binding metadata; private credential remains with the platform authenticator.
- **Likely causes:** unsupported browser/device API; feature disabled; SmartAccount not discovered; stale binding after epoch change; session-local binding metadata absent.
- **Diagnostic evidence:** Wallet build, browser/OS, WebAuthn support, network, public SmartAccount420 address, authorization epoch, public binding status.
- **Retry safety:** safe for enrollment UI retries only after verifying the intended account/network; do not repeatedly sign state-changing actions while binding state is unclear.
- **Recovery:** use explicit enrollment/re-enrollment; restore via qualified client support where available; never export/copy passkey private material.
- **Escalation:** stop if any support flow asks for passkey private material or authenticator secrets.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#passkey-unavailable), [Wallet setup and protection](../users/wallet/setup-and-protection.md).

## TRB-WALLET-006 — Signing or simulation failed

- **Audience:** user, developer
- **Surface:** transaction/message signing and simulation
- **Severity:** value-risk
- **Symptom:** preflight simulation reverts/fails, or signing cannot proceed under the current authority.
- **Authority source:** canonical contract/account state, current authorization state and the qualified simulation/signing result.
- **Likely causes:** call would revert; stale state; invalid target/value/calldata; expired deadline; insufficient balance; insufficient capability/session authority; stale passkey binding.
- **Diagnostic evidence:** network, public sender/account, target, value, transaction request fields that are safe to share, simulation/revert result, current authorization epoch, no secrets.
- **Retry safety:** unsafe to bypass simulation or blindly resubmit a write.
- **Recovery:** inspect the reason; refresh canonical state; correct the transaction/authority; re-simulate; sign only after the request is understood.
- **Escalation:** stop on unexpected target/value/data, unexplained authority escalation or suspicious signing prompts.
- **Related:** [Wallet signing review](../users/wallet/signing-and-simulation.md), [Wallet troubleshooting](../users/wallet/troubleshooting.md#simulation-failed).

## TRB-WALLET-007 — Recovery action is unavailable or countdown appears wrong

- **Audience:** user
- **Surface:** SmartAccount420 recovery
- **Severity:** security-critical
- **Symptom:** propose/cancel/finalize recovery is disabled, or the displayed recovery countdown disagrees with expectations.
- **Authority source:** canonical SmartAccount420 owner/recovery role and timelock state.
- **Likely causes:** wrong role; wrong account/network; no configured recovery authority; timelock not expired; stale presentation state; recovery authority needs explicit account address.
- **Diagnostic evidence:** network, public SmartAccount420 address, current owner/recovery public addresses, proposal state, canonical executable timestamp/block state. Never share recovery secrets.
- **Retry safety:** not-applicable for attempts to bypass role/timelock rules; safe to refresh/read canonical state.
- **Recovery:** verify role and network; refresh canonical account state; follow the qualified propose/cancel/finalize path; trust canonical timelock state over browser countdowns.
- **Escalation:** stop if ownership, recovery authority or pending recovery state is unexpected.
- **Related:** [Recovery and device safety](../users/wallet/recovery-and-device-safety.md), [Wallet troubleshooting](../users/wallet/troubleshooting.md#recovery-action-is-disabled).

## TRB-WALLET-008 — Transaction remains pending

- **Audience:** user, developer
- **Surface:** Wallet transaction activity
- **Severity:** value-risk
- **Symptom:** a submitted transaction has a hash but remains pending or unresolved.
- **Authority source:** canonical RPC/mempool/receipt state for the transaction hash and sender nonce; Wallet/Explorer views are presentation layers.
- **Likely causes:** congestion; insufficient fee conditions; earlier nonce unresolved; RPC/provider lag; transaction dropped/replaced; wrong network view.
- **Diagnostic evidence:** transaction hash, sender, network, nonce, value/gas parameters, canonical receipt query, earlier same-account pending transactions.
- **Retry safety:** conditional. A timeout is not proof of failure; do not create another write until hash/nonce state is checked.
- **Recovery:** verify network/hash; inspect receipt and nonce state; use only a qualified replacement/cancellation flow that explains the nonce effect.
- **Escalation:** stop if the Wallet cannot establish whether the original transaction exists or if replacement would move value unexpectedly.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#transaction-remains-pending), [Send and receive `$420`](../users/wallet/send-receive-and-activity.md).

## TRB-WALLET-009 — Included transaction failed

- **Audience:** user, developer
- **Surface:** Wallet transaction activity / execution result
- **Severity:** value-risk
- **Symptom:** the transaction was included but its receipt indicates failure/revert.
- **Authority source:** canonical transaction receipt and contract/account state at execution.
- **Likely causes:** revert; changed state; insufficient authority; expired deadline; invalid calldata; insufficient balance; stale capability/session.
- **Diagnostic evidence:** transaction hash, receipt status, block/finality state, non-secret revert/error information, public sender/target.
- **Retry safety:** conditional; failed included transactions can consume gas and canonical state must be re-read before another submission.
- **Recovery:** inspect receipt/error; refresh account/contract/authorization state; correct the cause; re-simulate before retrying.
- **Escalation:** stop if failure reason is unclear for a value-changing action.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#transaction-failed), [Send and receive `$420`](../users/wallet/send-receive-and-activity.md).

## TRB-WALLET-010 — Wallet balance or activity appears stale

- **Audience:** user, developer
- **Surface:** Wallet/Explorer/Indexer presentation
- **Severity:** degraded
- **Symptom:** balance, activity or transaction status differs between Wallet, Explorer, Indexer or another read surface.
- **Authority source:** canonical chain state at the relevant finality level.
- **Likely causes:** Indexer lag/rebuild; RPC provider lag; reorg; stale cache; different network/finality view.
- **Diagnostic evidence:** network, public account, transaction hash/block, canonical receipt/balance query, derived service readiness/cursor where available.
- **Retry safety:** safe for reads; unsafe to submit compensating writes merely to make the UI match.
- **Recovery:** verify canonical state and finality; compare qualified read endpoints; allow derived services to catch up/rebuild.
- **Escalation:** escalate if canonical sources disagree or the intended network cannot be established.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#balance-or-activity-looks-stale), [420Indexer developer guide](../developers/reads-apis-indexer.md).

## TRB-WALLET-011 — Suspicious approval or possible authority compromise

- **Audience:** user
- **Surface:** Wallet owner/operator/capability/session/recovery authority
- **Severity:** security-critical
- **Symptom:** an unexpected approval/signature was authorized, a suspicious dApp has authority, or owner/operator/recovery state may be compromised.
- **Authority source:** canonical SmartAccount420 authority state plus canonical transaction history.
- **Likely causes:** malicious/compromised application; overbroad capability/session; device/browser compromise; unintended signing; authority change.
- **Diagnostic evidence:** public account, suspicious transaction hashes, public capability/session identifiers, current public owner/operator/recovery state. Never share secrets.
- **Retry safety:** unsafe for further signing until containment is complete.
- **Recovery:** disconnect the application; inspect recent transactions; revoke suspicious capabilities/sessions; verify owner/operator/recovery state; move to a trusted device; use canonical recovery if owner authority is no longer trustworthy and valid recovery exists.
- **Escalation:** escalate immediately when ownership/recovery authority changed unexpectedly or active compromise is suspected.
- **Related:** [Wallet troubleshooting](../users/wallet/troubleshooting.md#i-approved-something-suspicious), [Recovery and device safety](../users/wallet/recovery-and-device-safety.md).

## Safe Wallet support bundle

A Wallet support request may include Wallet build/version, OS/browser, network/chain ID, public account/SmartAccount420 address, transaction hash, stable `TRB-WALLET-*` ID, exact non-secret error text, reproduction steps and finality state.

Never include seed phrases, private keys, passkey private material, recovery secrets, signing-device secrets, bearer tokens, authentication recovery codes or exported secure-store contents.
