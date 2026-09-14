---
title: 420 Wallet FAQ
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet FAQ

## Is 420 Wallet the account itself?

No. 420 Wallet is a replaceable client over the canonical Smart Account and authorization system. Changing qualified clients does not replace the account's canonical authority model.

## Does connecting a dApp let it spend my funds?

No. Connection and reusable authority are separate. Spending, contract execution, capabilities and sessions require the appropriate canonical authorization.

## Where are my private keys stored?

A 420-operated Wallet server must not possess user signing keys. Signing remains at the user/device/account boundary according to the selected signing method.

## Can support recover my account instantly?

No. Support cannot bypass canonical recovery rules. The current recovery model is timelocked and must follow the account's on-chain recovery semantics.

## Why does the Wallet show a controller address and a Smart Account address?

A controller/signing identity may authorize a distinct `SmartAccount420` address. Confirm which address a destination expects before transferring assets or administering account state.

## Can I use more than one Wallet client?

Yes, provided the clients are qualified for the network and use the same canonical account/capability/recovery semantics. Client-local preferences may differ; canonical authority must not.

## Is a Wallet simulation guaranteed to match execution?

No. Simulation is a pre-authorization safety aid. State may change before execution, and external/provider conditions can differ.

## Why can an on-chain transaction fail after I signed it?

The transaction may encounter changed state, contract rejection, insufficient gas/value or another execution condition. An on-chain failure may still consume gas.

## Does the Wallet charge its own fee?

The Genesis Wallet does not introduce a fee merely for viewing an account, connecting an application or reviewing a request. Network and protocol/application actions can carry their own costs.

## How do I know an ecosystem link is legitimate?

Prefer destinations resolved through official repository links, canonical Registry state or a signed/versioned ecosystem manifest. Branding or a familiar-looking URL alone is not sufficient proof.

## What should I share with support?

Public account addresses, transaction hashes, error identifiers, client version and network information are normally safe. Never share private keys, seed phrases, passkey private material, raw signing secrets or recovery secrets.
