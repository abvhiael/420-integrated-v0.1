# 420 AI Provider Runtime

AI-RECOVERY-3 introduces the Genesis provider control-plane runtime for 420AI + 420 ComputeMarket.

This package is deliberately **not** a validator, wallet, custody service, or embedded private-key signer. It reconciles canonical AI/Compute state, validates provider/runtime manifests, retrieves off-chain payload bytes, dispatches work to an injected inference backend, commits outputs, and hands canonical state-changing operations to an external authorized transaction adapter.

## Trust boundaries

- The chain remains authoritative for provider, request, match, job, verification and settlement state.
- Worker queues are rebuildable derived state.
- Private prompts, datasets and outputs remain off-chain.
- The daemon checks the payload bytes against the canonical Compute request commitment before execution.
- AI and Compute provider IDs, requester, workload, privacy profile, verification profile, spend ceiling and deadline must agree.
- AI-to-Compute constraints may narrow, never broaden.
- Model engines are injected through `InferenceBackend420`.
- Payload storage/retrieval is injected through `PayloadPort420`.
- Chain-changing actions use `ProviderTransactionPort420`; the runtime does not contain private keys.
- Result commitments and execution-manifest commitments use Keccak-256 over deterministic bytes/canonical JSON.
- API/status projections are explicitly non-authoritative.

## Job execution path

For a canonical assigned job:

1. verify current provider manifest and backend health;
2. read the canonical AI provider, AI job, Compute job and Compute request;
3. verify provider identity, active stake reference and AI↔Compute provider binding;
4. verify requester/workload/privacy/verification/deadline/spend constraints;
5. advance MATCHED -> ACCEPTED through the external transaction adapter;
6. advance ACCEPTED -> RUNNING through the external transaction adapter;
7. retrieve the private payload only when the job is RUNNING;
8. verify payload commitment against canonical state;
9. execute the selected backend;
10. store result bytes off-chain;
11. create deterministic output and execution-manifest commitments;
12. enforce charge <= funded amount and AI maximum;
13. submit Compute result commitment;
14. submit the final monotonic Compute receipt.

Verification and settlement remain separate protocol stages. This runtime does not mark its own result VERIFIED or SETTLED.

## What remains for production/testnet integration

The package intentionally exposes ports rather than hardwiring infrastructure. AI-RECOVERY-3 follow-on integration must provide:

- an RPC/Indexer-backed `CanonicalStatePort420`;
- a qualified external transaction/signing adapter for provider-authorized methods;
- one or more payload transports, ideally backed by 420Storage/420Gateway;
- concrete model-serving backends;
- encrypted/private payload delivery where required by policy;
- production verifier adapters;
- process supervision, metrics export and deployment manifests;
- API transport for `ai.420integrated.org`.

Run:

```bash
npm install
npm test
```
