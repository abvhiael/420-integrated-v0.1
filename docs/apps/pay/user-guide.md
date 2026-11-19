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

In the personal dashboard, connect 420 Wallet to view balances and payment
activity for the selected address. Use **Load earlier activity** to check earlier
blocks, the activity filter to show sent or received payments, and **Settings**
to hide amounts on screen. **Download receipt** exports verified payment
evidence. Fixture mode is explicitly labelled and exports sample data.

Under **Send & request**, paste a recipient, .420 name or Pay link, or choose a
QR image to read. Review the resolved address and amount before continuing in
420 Wallet. A submitted transaction appears in Wallet activity. If the outcome
is unclear, check that activity before trying again.

Choose **Receiving address** for a reusable link, **Amount request** for an
amount with an expiry, or **Existing invoice** for a canonical invoice you own.
Use **Copy link** or **Download QR image** to share it. The invoice review
shows canonical terms. Checkout handles invoice settlement.

See [permissions](permissions.md) and [recovery guidance](troubleshooting.md).
