# CCTP local qualification results

Date: 2026-11-15. Baseline `main`: `97413f2eea862d5f2ec3117313cd3beb15a634f4`.

| Qualification | Actual result | Retained artifact |
|---|---|---|
| Solidity / Foundry 1.9.0 / solc 0.8.24 / Cancun / IR / 200 optimizer runs | **55 unique tests qualified**, including 2,500 fuzz cases | `solidity-owners.log`, `source-address-guard.log` |
| SDK, ABI, issuer/version/network separation and adversarial preflight | **33 passed** | `sdk.log` |
| Genuine historical CCTP messages and issuer attestations | **5 authenticated**; four observed successful destination receipts/mint logs; five actual native contract replays | `historical.json`, fixture provenance |
| Actual GatewayRouter/lifecycle/risk/accounting with actual Circle native protocol contracts | Inbound native mint and VERIFIED lifecycle, risk-triggered native mint/nonce rollback, outbound native burn and SOURCE_PENDING lifecycle passed | Solidity logs |
| Actual pinned Circle native implementation build | **4 creation artifacts match exactly**, 47 source/license files checked | `native-upstream-build.log`, upstream manifest |
| Production adapter size | **12,828-byte runtime**, below EIP-170 | `bytecode.json` |
| New live read-only Iris client | One genuine V2 message verified; no mint/transaction sent | `live-fetch.log` |
| Direct public issuer eligibility observation | 420Chain absent from Circle native-USDC/domain lists; no assigned domain; private approval not established | `issuer-observation.log`, fixture observation |

The final relevant-owner run produced 54 passing tests and one failure: the dirty EVM source-sender check ran after native signature validation, so rejection occurred at the wrong asserted boundary. Canonical source-address validation was moved before the external native receive call. The failed test and seven affected genuine-message/router paths then passed (8/8). The 54-pass evidence and precise failure are retained; only affected qualifications were rerun. No assertion was weakened. All 55 unique tests are qualified by that evidence union. Earlier targeted 46-pass, 3 gateway and 3 extra issuer-adversarial logs are also retained with their original results; those are not added again to the unique total.

The five genuine message/attestation pairs were unchanged. Source publication, native bytecode rebuild and SDK qualification do not fabricate 420 support. Native protocol contracts are actual pinned upstream code; the token and Genesis environment are controlled test doubles. No deployed 420Chain native-USDC mint authority, private Circle approval, production runtime address or mainnet readiness is asserted.

GitHub Actions run IDs: **none**. Qualification ran locally; publication skips redundant CI. The publication SHA and exact tree are recorded in the PR. Full-step acceptance remains open solely on the documented issuer-support/approved-network integration conditions; no merge or deployment is claimed.
