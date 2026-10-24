# HC-NEXT-5.2 — Authenticated mission lifecycle

This implements a registered-player, wallet-optional, noncanonical mission lifecycle that preserves on-chain R04.7 MissionEngine authority. Mission activation, progress, completion, entitlement claim, cancellation and expiry are tracked in the same serializable persisted account store as BUDS, but **do not** mint BUDS or canonical assets. Canonical on-chain mission claims and actual rewards still require the separate approved R04.7/R04.5 trust and testnet acceptance path.

## Frozen V1 numerical mission catalogue

Version: `HC-MISSIONS-V1`; declared in `services/highcountry-economy/src/mission-catalog-v1.js`.

| Mission | Required independently verified activity | Prerequisite claimed | Target | Proof cap | Duration | Reward |
|---|---|---|---:|---:|---|---|
| journal-first-steps | verified-journal-entry | none | 2 | 1/event | 24 hours | 0 BUDS; metadata receipt |
| field-notes | verified-field-observation | journal-first-steps | 3 | 1/event | 48 hours | 0 BUDS; metadata receipt |
| workshop-checklist | verified-workshop-check | field-notes | 3 | 1/event | 72 hours | 0 BUDS; metadata receipt |

These are new conservative V1 baseline values, not retrospectively asserted historical R04.7 approved numerical parameters. Rewards are explicitly zero until a separately approved bounded economic source and canonical issuer are commissioned. A claim returns immutable metadata `{kind,units,objective,version}`, not a redeemable payout. No deposit, penalty or confiscation is introduced.

## State machine and invariants

`available -> active -> complete -> claimed`; `active -> cancelled`; `active|complete -> expired` on deadline. At most one activation per player/mission/catalogue version. Deadline is frozen when activated. No progress at or beyond deadline, no claim at or beyond deadline, no cancellation after completed, no restart after expiry/cancellation/claim. An exact target completes; overshoots and duplicate proofs are rejected.

Player principal is derived only from authenticated registered sessions. The current account epoch is checked inside the serialized database transaction. A player cannot supply owner, version, objective, target, duration or reward amount in the HTTP request. The independently signed gameplay proof binds `HC.MISSION.EVIDENCE.V1`, `issuer`, `gameId`, `chainId`, `principal`, `missionId`, `objective`, `version`, `amount`, unique `sourceEvent` and `expiresAt` within five minutes. The distinct event identifier is globally replay-proofed for mission claims and cross-checked against skill/research proof identifiers. This prevents rewarding mission progress for an unverified client action or duplicate trading event; the issuer still must enforce actual trusted gameplay outcomes and reject self-trade before signing.

Durable `missions` and `missionProofs` state are backward-compatible additions to the PostgreSQL schema 1 JSON envelope and memory transaction fixture. Failed serialized writes roll back. No player wallet required; the service does not grant on-chain rights, mutate protected yield/genetics/competitive scoring, create inventory, or settle escrow.

## Browser and APIs

`/missions` displays the server-derived list, objective, immutable target, verified progress, deadline, state, zero-issuance reward metadata, activation, signed proof submission, claim and cancellable active states. All ordinary calls use authenticated `POST /missions/{snapshot,activate,progress,claim,cancel,expire}`. Request fields are explicitly allowlisted. Expiry occurs automatically on state inspection or can be requested after the deadline. Offline guests receive an explanatory view with no wallet requirement.

## Deployment gate

Production `start-runtime.js` accepts optional reviewed `missions` config only if `catalogVersion: "HC-MISSIONS-V1"` with `evidencePublicKey` (pinned Ed25519 PEM) and `evidenceIssuer`. No verifier configured means the routes are unavailable. A real gameplay proof issuer, audit of self-trade farming, and official deployed chain/issuer qualification are **not** proven by unit fixtures. Real BUDS rewards remain a separate production-qualified integration gate and are not inferred from metadata.

## Qualification

Focus tests: activation, prerequisite isolation, bounded progress, signed evidence game/chain/objective/time binding, expiry, irreversible cancellation, repeat/duplicate evidence, session revocation, metadata-only claim, no BUDS or canonical mint; authenticated HTTP field enforcement, persisted PostgreSQL restart/conservation, browser offline route and real Chromium, plus affected economic Level 1/2 and R04 application regressions. Retain unrelated globally qualified SHA evidence; do not run global Level 3 for this ordinary step.
