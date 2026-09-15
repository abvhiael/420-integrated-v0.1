# 420 Bridge architecture

420 Bridge composes chain, asset, route, gateway/adapter, risk, transfer-registry and accounting/reconciliation surfaces.

Inbound execution verifies external proof, then independently rechecks local canonical asset status, route health/direction, risk limits and replay state before creating/releasing destination value. Outbound execution applies the same local policy/risk checks before initiating the external message.

Accounting reconciliation records evidence/health but cannot silently mint, burn or repair user balances.
