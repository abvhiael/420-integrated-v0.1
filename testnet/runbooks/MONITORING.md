
# Testnet Monitoring Baseline

Alert on:
- no certified block for 42 consecutive slots;
- SAFETY_HALT trigger;
- conflicting valid QCs;
- active seats < 15;
- eligible validator pool < 60;
- Engine API errors;
- node420 execution head lag;
- peer count collapse;
- randomness degradation;
- disk persistence failures;
- public RPC error rate/latency;
- faucet abuse/rate-limit exhaustion;
- bridge/gateway pause or verification failures.

Dashboards should show head, safe, finalized, slot, epoch, rotation, active/eligible counts,
attestation participation, proposer rank, fallback usage, base fee, issued/burned supply, and
node420/fourtwentyd version hashes.
