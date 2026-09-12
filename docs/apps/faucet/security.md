---
title: 420 Faucet security
audience: [user, developer, operator]
category: application
status: development
version: current
---
# Security

Users should provide only the destination testnet address and any ordinary abuse-control response required by the service. Never disclose signing secrets.

The Faucet operator must keep the Faucet wallet separate from mainnet custody and use **no mainnet keys**. Required controls include CAPTCHA or equivalent abuse resistance, IP/address throttling, automated-spraying denial, daily distribution caps, telemetry and an emergency pause.

Treat unexpected requests to import a seed phrase, sign an unrelated transaction, approve token spending or install software as malicious.

A Faucet service response is not canonical proof of balance. Verify the actual transfer on the selected testnet.