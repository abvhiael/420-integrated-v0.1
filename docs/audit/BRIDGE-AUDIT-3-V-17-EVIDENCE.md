# BRIDGE-AUDIT-3.V.17 — Authentic Blockchain Evidence Catalogue

**Catalogue implementation and local qualification complete.** Baseline `main`: `97413f2eea862d5f2ec3117313cd3beb15a634f4`. Date: 2026-11-15, America/Regina. No merge requested; no live deployment, issuer authorization, validator root or production route changed.

[Dataset, source pins and reproduction commands](../../evidence/bridge/README.md) · [Machine-readable qualification](evidence-catalogue-qualification/RESULTS.json) · [22 targeted tests](evidence-catalogue-qualification/tests.log) · [Independent reacquisition](evidence-catalogue-qualification/reacquisition.json).

| Original requirement | Delivered evidence |
|---|---|
| Genuine historical block headers | Immutable original bytes for all available chain families; unavailable post-genesis PotCoin data explicitly disclosed. |
| Consensus checkpoints and validator data | Retained chain-specific historical checkpoints, validators and consensus proofs; untrusted Solana stake observations separately classified. |
| Authentic transactions and receipts | Public historical chain transactions/receipts, shielded sample, CCTP/native issuer records, with precise scope per artifact. |
| Merkle and other inclusion proofs | Original Bitcoin-family, Ethereum, BNB, Tron, XRPL and Pirate qualification proof material, preserving original source lineage. |
| Genuine issuer attestations | Five CCTP message/attestation pairs and native protocol qualification; CADC native protocol observations and retained fork execution results. |
| Gateway evidence where available | Genuine native issuer protocol transfers identified separately; no unrelated payment or controlled gateway fixture establishes full 420 gateway authorization. |
| Independently verified expected results | Original independent oracle/native replay results retained, plus 39 bounded independently recomputed identity/wire checks. |
| Provenance and cryptographic checksums | 495 artifacts, fixed source commits/paths/blob identities, SHA-256 per artifact, locked inventory, catalogue digest, 418 original checksum matches with zero conflicts. |
| Distinguish synthetic from genuine | 12 controlled vectors and 18 RPC observations separated from 341 historical/derived records; adversarial tests reject scope escalation. |

22 targeted catalogue tests passed. Independent reacquisition of every pinned original Git blob, plus checksum-anchored recovery of 19 original omitted logs, reproduces catalogue SHA-256 `aeb75831e79bc618f333db418d790ef254751c4f050684af6b238d82555d2dd6`. All 25,240,921 payload bytes are included. Original qualification source SHAs and records remain unchanged; consensus test reruns: zero. CI run IDs: none (local qualification). Publication uses the repository's existing `[skip ci]` convention to avoid unrelated automatic workflows; no workflow triggers, branch restrictions or approval process added.

Authenticity scope is bounded by each retained proof and its original trust assumptions. Source code in prior unmerged PRs is not silently integrated by copying its fixtures. The catalogue is complete for available evidence; outstanding chain/gateway/issuer infrastructure qualifications remain exactly the limitations recorded by those earlier audits. No new roadmap task or testnet deferral is invented here.

Current main and the supplied task sequence do not define a numbered successor to V.17. None is invented or started.
