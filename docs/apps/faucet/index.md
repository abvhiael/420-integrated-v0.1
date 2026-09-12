---
title: 420 Faucet
audience: [user, developer]
category: application
status: development
version: current
---
# 420 Faucet

420 Faucet is the **testnet-only** distribution service for developer onboarding and application testing. It distributes testnet `$420` that has **no monetary value** and never participates in mainnet genesis economics.

The canonical testnet policy currently distributes **42 testnet `$420` per successful request**, enforces a **24-hour per-address cooldown**, limits a source IP to **5 requests per hour**, and requires CAPTCHA or equivalent abuse controls. Operator policy also caps total daily distribution at **42,000 testnet `$420`**.

The Faucet is an operational service, not protocol monetary policy. A faucet response proves only that the service accepted or processed a request; users and tools should verify the resulting balance on the selected testnet through canonical chain/RPC state.

Use [Getting started](getting-started.md) for a safe request flow and [Developer integration](developer/index.md) for programmatic access.