# 420 Pay local release closeout

Start with the [user guide](user-guide.md), [developer API manual](developer-integrations.md)
and [operator deployment runbook](deployment-operations.md). Device build
and signed-link configuration are documented for [Android](android.md) and
[iOS](ios.md). The [ecosystem guide](ecosystem.md) identifies the authorities
for downstream payment, refund and reorg evidence.

## Reproduce the local package

With Node.js 22 and Python 3, use a checkout of the qualified revision.

```sh
npm ci --prefix packages/420-pay-sdk --ignore-scripts --no-audit --no-fund
npm ci --prefix pay/web --ignore-scripts --no-audit --no-fund
npm run build --prefix packages/420-pay-sdk
npm run build --prefix pay/web
python3 scripts/package-pay-app-release.py --web-dir pay/web/dist --output /tmp/420pay-release
(cd /tmp/420pay-release && sha256sum -c SHA256SUMS)
```

The release workflow repeats the web build and compares both archives
byte for byte. The source archive contains Pay application sources, locked
dependencies, manuals and retained contract material from the candidate Git
tree. The web archive contains a public static build with a null deployment
configuration. Each archive has a `PAY-RELEASE.json` containing the full
revision and member SHA-256 hashes. Mobile artifacts retain their original
build revisions and signing status.

## Retained engineering evidence

| Scope | Qualified source | Evidence |
| --- | --- | --- |
| Native quote, checkout, authorization and delivery | `3443a967387168263c72c91b4c46b8a18fec2dd3` | [Native checkout](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44474622603) |
| Web, accessibility, privacy and developer service | `3443a967387168263c72c91b4c46b8a18fec2dd3` | [Dashboard and service](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44474622540) |
| Market, Commerce and Indexer recovery | `ff5f60b86f7a062ac22500d949dc2c06aa3ed223` | [Ecosystem](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881933), [Indexer](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881986), [Commerce security](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881834) |
| Android and iOS packages and device qualification | `ff5f60b86f7a062ac22500d949dc2c06aa3ed223` | [Android APK/AAB and emulator](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472882052), [iOS unsigned build and simulator](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881844) |

For security review, use the [qualification record](qualification.md),
[authority model](permissions.md), and [privacy and security guide](security.md)
alongside the Git revision and run artifacts. The review scope includes
Registry and runtime identity, quote and Wallet authorization, replay and
refund delivery, tenant boundaries, webhook recovery and platform handoff.
Repository qualification supplies evidence for independent review.

## Live activation gates

The [PAY-APP-18 testnet work](PAY-APP-ROADMAP.md#pay-app-18--public-testnet-deployment-and-live-acceptance) tracks the outstanding tasks and acceptance evidence.

- Verify governance, chain and Registry identities, deployed runtime hashes,
  permissions, health dependencies and the actual Swap executor binding.
  The retained PAY-AUDIT-6 and V3 artifacts describe earlier reviewed inputs.
  Compare current contract source and runtime against the intended deployment
  before promoting a candidate. The application archives do not rematerialize
  or authorize revised resident bytecode.
- Bind the deployed Pay and Wallet origins, finalized RPC and Indexer feed,
  operator credentials and approved webhook receivers. Keep the web bundle
  unbound until those deployment inputs are verified.
- Obtain release signing and publish verified platform associations for
  Android and iOS. Native approval and return require the corresponding
  Wallet transport. Hosted Wallet checkout remains the approval path.
- Retain live receipts, recovery evidence and deployment provenance in
  PAY-APP-18 and PAY-AUDIT-7. Local packages carry neither live chain evidence
  nor production signing credentials.
