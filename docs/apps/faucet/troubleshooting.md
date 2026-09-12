---
title: 420 Faucet troubleshooting
audience: [user, developer]
category: application
status: development
version: current
---
# Troubleshooting

**Faucet unavailable** — confirm you are on a supported testnet and that network discovery exposes Faucet capability. Mainnet correctly has no Faucet.

**Address rejected** — verify the address is a valid `0x` plus 40-hex-character EVM address.

**Cooldown active** — wait until the 24-hour per-address cooldown expires. Do not rotate addresses to evade abuse controls.

**Rate limited** — the source IP may have exceeded 5 requests in the current hour.

**Request accepted but balance unchanged** — inspect the service response and then check Wallet/Explorer/RPC for the transfer. Service submission is not balance proof.

**Daily cap or hot wallet exhausted** — retry after operators restore capacity; do not treat an outage as a protocol failure.

**CAPTCHA failure** — complete the supported challenge or equivalent abuse-control mechanism.