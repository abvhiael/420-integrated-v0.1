---
title: 420 Faucet concepts
audience: [user, developer]
category: application
status: development
version: current
---
# Concepts

**Testnet-only** means Faucet capability is absent on mainnet and production-network discovery must return no usable Faucet endpoint.

**Distribution amount** is the current policy amount of 42 testnet `$420` per successful request.

**Cooldown** is the 24-hour per-address interval between successful requests.

**Rate limit** is the current source-IP limit of 5 requests per hour.

**Daily operator cap** is the current 42,000 testnet `$420` maximum distribution budget per day.

**Abuse control** includes CAPTCHA/equivalent checks, address/IP throttling, automated-spraying denial and emergency pause.

**Operational service** means Faucet does not define native issuance, consensus rewards, mainnet monetary policy or any entitlement to real-value assets.