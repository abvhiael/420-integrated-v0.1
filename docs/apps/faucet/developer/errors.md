---
title: 420 Faucet errors
audience: [developer]
category: application
status: development
version: current
---
# Errors and retries

Integrations should distinguish:

- invalid test account address;
- selected network is not testnet;
- testnet does not advertise Faucet capability;
- Faucet endpoint unavailable or malformed;
- transport/service response invalid;
- address cooldown active;
- IP rate limit exceeded;
- abuse-control denial;
- Faucet paused;
- daily cap reached;
- hot wallet lacks capacity.

Retry only conditions that can safely change. Do not automatically evade cooldown or IP limits, spray alternate addresses, or infer success from a malformed response. After any apparent success, confirm on-chain state.