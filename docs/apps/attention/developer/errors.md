# 420 Attention errors and retries

Common failures include no active consent, inactive/closed campaign, observation outside window, wrong verifier, reused nullifier, per-account cap exceeded, insufficient campaign funds, wrong claimant and already-paid reward.

Do not retry deterministic failures by weakening consent or proof rules. Retry transient RPC/indexing/provider errors with bounded backoff and re-read canonical state.