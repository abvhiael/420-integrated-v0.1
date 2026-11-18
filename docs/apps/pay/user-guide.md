---
title: Review a 420 Pay payment
audience: [user, developer]
category: applications
status: current
version: current
---

# Review a 420 Pay payment

The [approved product scope](PAY-APP-0-PRODUCT-SPECIFICATION.md) defines these steps for a qualified deployment. Check the [deployment requirements](deployment-operations.md) before using a payment origin.

1. Confirm the network and account in 420Wallet. A receiving-address QR identifies a recipient. An invoice QR identifies a specific payment request.
2. Verify the invoice, merchant, recipient, asset, amount, expiry and origin. Review fees, tip and minimum output in Wallet before authorizing.
3. If terms change or the quote expires, refresh and review the replacement before signing.
4. Check the canonical payment status. Submission and inclusion can precede settlement. Download a receipt from the qualified payment record.

See [permissions](permissions.md) and [recovery guidance](troubleshooting.md).
