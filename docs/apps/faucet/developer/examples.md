---
title: 420 Faucet examples
audience: [developer]
category: application
status: development
version: current
---
# Examples

## Safe request flow

```text
discover testnet network
-> require faucet capability
-> resolve HTTPS faucet endpoint
-> validate destination address
-> submit { address }
-> receive service response
-> query RPC/Explorer for resulting transfer/balance
```

## Unsafe patterns

Do not:

- expose or request private keys;
- call Faucet on mainnet;
- treat Faucet response as canonical balance proof;
- bypass cooldown/rate limits with automated spraying;
- hard-code mainnet custody credentials into Faucet infrastructure;
- represent testnet `$420` as having monetary value.