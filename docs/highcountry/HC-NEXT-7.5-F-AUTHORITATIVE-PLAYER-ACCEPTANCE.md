# HC-NEXT-7.5-F — Authoritative player-journey acceptance

This is the bounded integration qualification for the original HC-NEXT-7.5 exit criterion: an actual player completing a season and two-semifinal/one-final tournament with independently reproducible results, canonical recognition and recovery. It **does not** conflate issuer-backed account identity with address-based on-chain competition identity.

## Executable acceptance

The single exact-SHA GitHub Actions job `.github/workflows/highcountry-next-7-5-f-acceptance.yml` executes `scripts/highcountry/hc-next-7-5-f-acceptance.sh` using Foundry/Anvil, Node 22 and two separate real PostgreSQL 16 databases:

1. The existing `R04CanonicalCompetition.t.sol` deploys canonical harvest product, finality evidence, entitlements, event registry and the complete Global420Cup contract. It rejects forged source block/owner/quality/time, repeated confirmation and results, adjudicated semifinal substitution, and revoked entitlement/cross-game recognition.
2. The issuer-backed ordinary exhibition tests run real serializable PostgreSQL migrations 010 and 012, participant registration and validated FLOWER proof, authenticated HTTP rejection, independently authorized pre-final challenge, finalized immutable outcome, append-only post-final review and restart/replay isolation. This is an **account-authoritative** track; local issuer mocks cannot represent production credentials.
3. The existing `hc-next-7-4-anvil-integration.sh` deploys actual Cup and competition contracts and advances Anvil through semifinal registration/results, semifinal finalization, final registration/results, Cup finalization and nonfinancial prestige issuance. It verifies actual deployment/transaction receipts, finalized EIP-1898 RPC, bytecode/chain pinning, canonical bracket, authenticated HTTP response, serializable PostgreSQL persistence, idempotent repeat reconciliation, and independently mined revocation that suppresses both HTTP and persistent current status without erasing history.

A single runner qualifies the integration between each real boundary without repeating unrelated Level 1/2/3 matrices. The retained historical tests in earlier packages remain evidence at their original SHAs; this fresh job qualifies the combined 7.5-F execution at its own exact SHA. No new on-chain mutators, paid prizes, new governance powers, mandatory preflight or deployment to production are added.

## Operationally external

Independent production/testnet validators, actual public-chain reorg scenarios, approved deployed code-hash manifests, external issuer credentials, production wallet association, operational TLS and multi-instance acceptance require separate actual deployment evidence; the simulation and isolated local PostgreSQL runner are not these credentials. Follow the existing `HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`. Never infer that an account-only exhibition player controls the address-based Cup winner.

**Roadmap:** After a passing combined job and verified merge, HC-NEXT-7.5's locally executable competition integrity and reproducibility exit is qualified. Remaining work returns to the canonical HC-NEXT roadmap; do not invent another 7.5 package.
