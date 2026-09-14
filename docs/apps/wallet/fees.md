---
title: 420 Wallet fees
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet fees

420 Wallet does not create a separate Wallet service fee merely because a user views an account, connects an application or reviews a signing request.

Fees arise from the underlying network/protocol action being authorized.

## Network fees

Transactions that consume execution resources require native `$420` according to the chain's gas/fee rules. The Wallet should show the estimated network cost before authorization when the information is available.

The final charged amount depends on actual execution and canonical fee accounting. A Wallet estimate is not a guarantee of the exact final fee.

## Protocol/application charges

Some actions may include protocol-specific costs such as swap fees, bridge fees, token-creation charges, validator bonds, deposits or other protocol economics. Those costs belong to the relevant protocol/application and must be shown separately from ordinary network gas whenever practical.

Do not interpret a Wallet balance deduction as evidence that the Wallet itself charged the amount.

## Failed transactions

A transaction can fail at execution while still consuming gas. The Wallet should distinguish:

- pre-submission simulation failure, where nothing was submitted;
- rejected signing/authorization, where nothing was submitted;
- submission failure before network acceptance;
- on-chain execution failure, which may consume gas;
- successful execution with a protocol/application fee.

## Sponsorship

If a future qualified flow sponsors gas, the Wallet must identify the sponsor boundary and must not imply that network execution became free at the protocol level. Sponsorship changes who pays; it does not eliminate resource accounting.

## Fee safety

Before signing, verify:

- network/chain identity;
- transaction target;
- native value being transferred;
- estimated gas/network fee;
- protocol/application fee where applicable;
- any deposit/bond that remains locked rather than spent;
- any approval/capability that could authorize later spending.

## Canonical fee reference

See [Gas, fees and native `$420`](../../architecture/chain/gas-fees-native-420.md) for chain-level fee semantics. Application-specific manuals define their own protocol charges and economic consequences.
