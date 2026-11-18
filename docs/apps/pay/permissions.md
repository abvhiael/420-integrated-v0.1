---
title: 420 Pay permissions
category: application
status: approved-genesis-scope
---

# Permissions and signing

420Wallet holds the signing authority and requires explicit transaction review. Verify the selected account, network, request origin, and any capability scope before granting access.

Merchant controllers authorize invoice operations and permitted roles. Cashiers and locations use scoped access. An API credential supports authorized merchant API activity. Spending still requires the canonical authorization path.

For deployment identity, verify the active, versioned `420/service/pay/v1` Registry record and code identity. See [security and privacy](security.md).
