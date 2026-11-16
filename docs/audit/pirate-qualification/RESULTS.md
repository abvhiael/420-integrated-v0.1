# Retained local qualification

Baseline main: `97413f2eea862d5f2ec3117313cd3beb15a634f4`.
Date: 2026-11-15. GitHub Actions: **not launched; no Actions run ID**. The publication commit retains these local results and skips redundant CI. The qualified publication SHA is recorded by the PR; this file does not embed a self-referential commit SHA.

| Owner | Actual result | Retained evidence |
|---|---:|---|
| Exact Solidity import closure, Foundry 1.9.0 / solc 0.8.24 / Cancun / IR | 46 passed, zero failed/skipped | `solidity.log` |
| Independent public evidence negative tests | 9 passed | `public-evidence-tests.log` |
| ABI composition and native/worker/domain bindings | 13 passed | `composition-tests.log` |
| Genuine historical mainnet Equihash + SHA256d target checks | 449 unique headers; 245 parent edges among the sample; one Sapling transaction Merkle inclusion | `historical-headers.log`, fixture provenance/checksums |
| Pinned native Rust proof/signature and private-file rejection checks | Final 20 passed; original 16 + 4 passing evidence retained | `native-crypto-final.log`; earlier `native-crypto-public.log`, `native-crypto-spend.log` |
| Owned-note adversarial witness, position, output, pool and caller-nullifier checks | 12 passed; affected wrong-pool parsing guard independently requalified | `owned-note-adversarial.log`, `viewing-key-guard.log` |
| Actual native v6.0.14 disposable regtest execution | Funding, Sapling deposit, Sapling→Ironwood deposit and subsequent Ironwood spend accepted; chain height 18 | `native-regtest.log`, `controlled-evidence.json` fixture |
| FVK-owned Sapling and Ironwood notes | Both pools decrypted; witness roots matched native state; received-note nullifiers matched subsequent native spends | `native-ownership.log`, `controlled-evidence.json` |

The wrong-pool test exposed an upstream Sapling `SpendValidatingKey::from_bytes` panic in constant-time option evaluation (`keys.rs:207`). The worker prevalidates RedJubjub encoding and contains unwinds with uniform generic rejection. Only relevant worker qualifications were repeated after those actual parser/error-protocol changes; native chain generation was not repeated for that fix.

The first EVM Equihash implementation was optimized before qualification: the historical header test is approximately 9.5 million gas, rather than its initial approximately 46.5 million gas. This is material for deployment gas budgeting; no production chain gas configuration is claimed qualified. The full verifier boundary tests also deploy contracts inside the test, so their reported gas includes test setup.

Source/evidence classes are deliberately distinct. Public historical data qualifies crypto and inclusion, not canonical tip/dPoW/ownership. Controlled native regtest establishes genuine local proof generation, execution, decryption, witnesses and subsequent spends, not genuine historical mainnet gateway activity. Controlled EVM/SDK authority records test authentication and rejection boundaries, not real native notary attestations.

No earlier family/PR evidence is replaced or rerun. Native wallet/RPC/viewing credentials and daemon logs are excluded from Git. Production native-state provider, historical notarization/anchor qualification and production gateway custody remain open as detailed in the main audit report. No merge or deployment is represented by local qualification.
