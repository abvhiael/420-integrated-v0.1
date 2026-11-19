# TREASURY-REC-3 — Native asset and 420Vault qualification

Status: **COMPLETE — targeted repository qualification passed**.

- Exact qualified implementation SHA: `e649d3a5b0dcae0aa0859750fe5a8808c5a9ed03`.
- Main baseline: `059a4c6690753b4dd084df762eeb449c189eebdd`.
- [PR #1225](https://github.com/abvhiael/420-integrated-v0.1/pull/1225).
- [Workflow 44574638401](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44574638401), job `135738686249`, completed successfully.
- Qualification used the complete Solidity import closure of six affected test owners with unchanged canonical compiler/fuzz configuration and exact checkout verification. No assertions were weakened, no tests skipped.

## Canonical asset and custody semantics

The Genesis execution denomination is documented in [gas-fees-native-420.md](../architecture/chain/gas-fees-native-420.md). Native asset identity is confirmed by `AssetVault420._recordNativeDeposit` / `_sendExact`, `PaymentRouter420.payNativeInvoice`, `PaymentRegistry420.recordNativeCheckoutWithTip`, and `pay/web/source.js` (18 native decimals). The zero address is native only, not an uninitialized/wildcard asset or a wrapped token. ERC-20 amounts remain exact base units of their explicitly allowed token. The Registry resolves services, not a replacement asset namespace. The native policy remains default-deny and requires governed admission. Existing contract ABI signatures, constructors and service IDs are unchanged.

The budget's vaultId is a registered instance ID, distinct from the VAULT_TREASURY type. Internal read-only `TreasuryVaultBinding420.resolveRelease` checks the trusted canonical Registry service identities/current runtime code hashes and dependency consistency, derives the exact stored budget/disbursement/Vault target, rejects wrong type, inactive or missing Vault, and checks recorded free balance. It does not transfer value, grant capability, reserve Vault balance, or claim independent receipt verification. Actual withdrawals still require the Vault route capability bound to vault, asset, recipient, action and amount. Treasury commitments are spending authority, not custody or financial escrow. The test fixture exercises actual registered AssetVault420 withdrawals before submitting a test-only release commitment; it is not a production executor or receipt format.

The adopted AUTHORIZED_EXECUTOR_COMMITMENT_ONLY model is unchanged. Connecting the production executor to release binding, actual evidence derivation, retry/recovery and downstream guarantees is REC-4; live receipt correlation is AUDIT-8. No claim is made that a compromised authorized executor cannot submit an arbitrary nonzero commitment.

## Results

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Native and Vault integration | 7 | 0 | 0 |
| Grants consumer | 17 | 0 | 0 |
| Treasury lifecycle | 13 | 0 | 0 |
| Treasury property/security | 5 | 0 | 0 |
| Deployment/Registry binding | 4 | 0 | 0 |
| Direct gateway | 2 | 0 | 0 |
| Total | 48 | 0 | 0 |

Both fuzz properties passed 2,500 runs each. Native and six-decimal token exact-unit transfer, default deny, unsupported token, unauthorized policy, insufficient recorded funds, failed native transfer rollback, wrong vault/asset/recipient/amount route denial, unregistered/type-only reference, revocation/freeze, retry and no parallel custody passed. The ERC-20 is an exact-transfer six-decimal fixture; Treasury, Vault, Registry and capability implementations are real contracts. The AUDIT-6 release and AUDIT-7 documentation verifiers passed.

| Artifact | SHA-256 | Compiled runtime template SHA-256 |
| --- | --- | --- |
| TreasuryPolicyRegistry420 | `f4c208d14382e9410fceef2c6659dfbc1d418b83c9a21bab439dabea38987528` | `d27fbcad75a69fb1cf5cd5b20a495064b1882977efafabd08b244d01a4fc464f` |
| TreasuryBudgetRegistry420 | `90887e7ec5edbd4ef8c2dd8709048e5fe3d825e14fd3ecdc9074749d8afe281d` | `3e277bb6de7503e8be5285e886ca03d71e6cdf62f2cc37fb90ec0a82e722adde` |
| TreasuryVaultBinding420 | `1d2faeeec147970a516234b323e5fe183d0d5540030cbc8217db7059e8cbc96d` | `725a0192384f769003fa8d5a36fbd9e4c94ebdfadb69ea44c4685dc03f1ece0f` |

These are compiler outputs, not live deployment hashes; the internal library adds no deployed service. Source verification confirms the disbursement/router and Vault custody source blobs are unchanged. The corrected TREASURY-INV-005 wording is executed <= committed <= ceiling; no accounting arithmetic changed. The automatically triggered broad Indexer workflow 44574638174 was still running at evidence capture; not counted as REC-3 qualification. Indexer source is unchanged and native assets remain the same address-string/uint event fields; REC-7 owns full read-boundary qualification. No extra unrelated workflow was manually dispatched. Prior passing evidence remains intact.

Next canonical step: TREASURY-REC-4 — Vault Release Evidence and Executor Qualification.
