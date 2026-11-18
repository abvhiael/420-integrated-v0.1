---
title: Troubleshoot 420 Pay
audience: [user, developer]
category: applications
status: current
version: current
---

# Troubleshoot 420 Pay

| Symptom | What to check |
| --- | --- |
| Service unavailable or wrong network | Verify the configured network and the active Registry service record. Stop if the origin or runtime identity cannot be verified. |
| Quote expired | Refresh the quote and review the new terms in Wallet before approving. |
| Payment pending | Check canonical transaction and invoice status before trying again. An indexed view may lag or change after a reorganization. |
| Refund requested | Check refund authorization, actual asset delivery, and reconciliation as separate events. |
| POS offline | Keep the cart or invoice as a draft. Confirm payment only after canonical online settlement evidence. |

See the [shared troubleshooting index](../../troubleshooting/index.md) and [deployment checks](deployment-operations.md).
