---
title: 420 Faucet events and observability
audience: [developer, operator]
category: application
status: development
version: current
---
# Events and observability

Faucet service telemetry is operational, not canonical protocol event state. Current operator telemetry includes request, success and denial counts, unique addresses over 24 hours, amount distributed over 24 hours and Faucet hot-wallet balance.

A successful on-chain transfer emits the ordinary execution/token/native-transfer evidence available from chain state; clients should use that evidence for canonical confirmation.

Retries and service failover must not be interpreted as additional protocol issuance authority. Operators should monitor rate-limit exhaustion and abuse patterns alongside Faucet health.