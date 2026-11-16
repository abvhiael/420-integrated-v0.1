# BRIDGE-AUDIT-3.V.18 — Adversarial Cryptographic Qualification

**Local implemented-boundary qualification complete.** Baseline main `97413f2eea862d5f2ec3117313cd3beb15a634f4`; original main and qualified PR source pins are retained. [Detailed scope, findings, reproduction and limits](../../qualification/bridge-adversarial/README.md).

- 113 passing Foundry unit/integration/fuzz/invariant tests: 80 new + 33 affected CADC regressions.
- 42,500 fuzz inputs; 122,880 stateful invariant calls across fourteen families; zero handler reverts.
- [196-entry original-requirement attack map](adversarial-qualification/coverage-matrix.json); no uncovered applicable implemented-boundary entries. Delegated/nonexistent consensus mechanisms are labelled explicitly rather than represented as tests.
- Seven independently computed Solana fixed-width instruction vectors plus dirty uint64 high-bit rejection; explicit Pirate note-position/native-supply limits.
- 182 original log files and 1,012 passing-case records retained byte-for-byte, including original failures as diagnostic failures. No old consensus suite rerun.
- Confirmed and corrected CADC alternate-envelope acceptance; integrated its qualified adapter/interface dependency from #1169. Positive native delivery, rejected serialization, replay-key preservation and actual router risk rollback pass.
- Restored the exact previously qualified Solana SHA-512 dependency and license omitted from main; original published hash matches.

[Machine-readable results](adversarial-qualification/RESULTS.json), [source locks](../../contracts/config/bridge/adversarial-sources-v1.json), [original-source CADC reproduction](adversarial-qualification/cadc-original-reproduction.log), [corrected CADC tests](adversarial-qualification/cadc-new.log), [affected tests](adversarial-qualification/cadc-affected.log), [router tests](adversarial-qualification/cadc-integration.log), and [source/record verification](adversarial-qualification/report-verification.log).

Only relevant path exclusions were added to existing unrelated workflows; job definitions and existing branch filters remain unchanged. [Trigger analysis](adversarial-qualification/trigger-isolation.json) identifies the remaining related Solana/contract qualifications. Publication uses existing `[skip ci]` to avoid repeating qualified local work or launching workflow-self-edit jobs. CI run IDs: none (local qualification); verify remote run inventory at publication.

Fresh envelope invariants cover untrusted admission and bounded rejection, not installed-profile or approved-gateway acceptance. Retained concrete proof/consensus/native protocol tests supply those implemented-boundary checks. Existing unavailable native/issuer/deployment/gateway evidence remains open under its original audit. No production trust root, route activation, live issuer approval or main merge is represented here.

No subsequent canonical step is defined in current main or supplied task scope. None is invented or started.
