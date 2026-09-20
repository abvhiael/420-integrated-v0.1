# GEN-11.19 — cross-client and cross-operator qualification

## Committed automated checks

- `probe.go` performs read-only JSON-RPC envelope and EntryPoint checks and rejects fabricated receipts for an unknown UserOperation; it does not send a transaction.
- `matrix.go` checks up to 16 endpoints individually without treating one success as success for the set.
- `domain.go` adds an **explicit expected-chain and EntryPoint check** against a 420 Bundler operator's `/readyz`, reporting individual wire/domain outcomes. An external implementation without `/readyz` needs a separately implemented and documented chain-identity adapter; a successful read-only wire check does **not** establish chain identity.
- `domain_test.go` covers matching domain, wrong chain, wrong EntryPoint, not-ready and offline operators, and a mixed two-endpoint matrix. These are scripted local fixtures, not independent operators.
- `bundler/cmd/bundler-interop420` is a read-only JSON-reporting runner. Example (replace all placeholders with actual qualified values):

```sh
go run ./bundler/cmd/bundler-interop420 \
  -chain-id 420 \
  -entry-point 0x1111111111111111111111111111111111111111 \
  -endpoint https://operator-a.example/rpc \
  -endpoint https://operator-b.example/rpc > operator-domain-report.json
```

The example EntryPoint, chain and endpoint domains are **illustrative**, not published live service configuration. The command exits 0 when every endpoint passes both wire and domain checks, 1 when any endpoint fails qualification, and 2 for invalid invocation or report-encoding errors. The report does not attest to operator identity, third-party client compatibility, browser CORS or signed-transaction acceptance.

## External acceptance record — required before claiming GEN-11.19 complete

For each separately operated endpoint, record the exact endpoint URL or a stable redacted identifier, operator and client implementation/version, chain ID, EntryPoint, timestamp, network, reproducible invocation, response evidence, and reviewer. Do not publish signing keys, authentication credentials or individual private operation payloads. Collect separate results for independent wallet clients and for web, extension and mobile surfaces where applicable.

1. Confirm endpoint operator **ownership independently**. Two URLs, ports or origins do not prove separate administration. `DomainMatrix.IndependentOwnershipVerified` therefore always remains false: operator identity must be checked outside the network probe.
2. Verify canonical chain ID and EntryPoint on both operators, canonical UserOperation hash and serialization against the same independent client vector, and refusal of wrong-chain and wrong-EntryPoint submissions without broadcasting a production transaction.
3. Record public JSON-RPC method compatibility, validation and replacement outcomes, qualified gas estimates, receipt/event and canonical-block reconciliation, and non-fabrication of unknown receipts.
4. Reproduce a pre-send outage/fallback between independently operated endpoints. Separately reproduce a timeout-after-accept and verify the client **does not** automatically resend the same signed operation. Do not use live funds or an uncontrolled network for adversarial tests.
5. Verify browser CORS and TLS in the actual web/extension/mobile delivery contexts. Document which Wallet UI surfaces actually route through the Bundler: a passing shared transport test does not activate those UI routes.
6. Record discrepancies between operators' receipt results and resolve using canonical execution-chain evidence, not by trusting a local Bundler status. Reorg/orphan scenarios belong to the GEN-11.20 final adversarial matrix as well.

## Release boundary

CI green on mocked clients is **code qualification only**. Without independently controlled live/testnet endpoints and recorded independent client acceptance, GEN-11.19 remains **implementation complete / external acceptance blocked**, not fully Genesis-qualified. This document does not grant permission to merge PR #341; GEN-11.20 reconciliation and exact-head qualification remain separate.
