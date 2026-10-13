"""BNB-4.6 deterministic noncustodial booking and economic reconciliation view.

All inputs are persisted 420BnB mirrors of independently authorized sources.
This module performs no payment, custody, refund, booking confirmation or mutation.
"""
from __future__ import annotations


def project_saga(*, reservation_state: str, hold_state: str,
                 intent_state: str | None, payment_id: str | None,
                 split: dict | None, disbursements: list[dict]) -> dict:
    """Fail closed on inconsistent evidence, preserving immutable financial authority."""
    if reservation_state not in {
        "payment_pending", "confirmed", "expired", "cancelled", "recovery_required"
    }:
        return {"state": "reconciliation_required", "reason": "UNKNOWN_BOOKING_STATE",
                "confirmation_verified": False, "bnb_custody": False}
    if intent_state not in {None, "pending", "finalized", "expired", "recovery_required"}:
        return {"state": "reconciliation_required", "reason": "UNKNOWN_PAY_STATE",
                "confirmation_verified": False, "bnb_custody": False}
    if reservation_state == "confirmed" and (
        hold_state != "confirmed" or intent_state != "finalized" or not payment_id
    ):
        return {"state": "reconciliation_required", "reason": "CONFIRMATION_EVIDENCE_MISMATCH",
                "confirmation_verified": False, "bnb_custody": False}
    if reservation_state in ("expired", "cancelled") and intent_state == "finalized":
        return {"state": "reconciliation_required", "reason": "LATE_FINALITY_RECOVERY",
                "confirmation_verified": False, "bnb_custody": False}
    if intent_state == "recovery_required" or reservation_state == "recovery_required":
        return {"state": "reconciliation_required", "reason": "PAY_RECOVERY_REQUIRED",
                "confirmation_verified": False, "bnb_custody": False}
    captured = None
    if split is not None:
        keys = ("captured", "host", "platform", "developer", "retained")
        try:
            amounts = {k: int(split[k]) for k in keys}
        except (ValueError, TypeError, KeyError):
            return {"state": "reconciliation_required", "reason": "INVALID_SPLIT",
                    "confirmation_verified": False, "bnb_custody": False}
        captured = amounts["captured"]
        if captured <= 0 or any(amounts[k] < 0 for k in keys) or (
            sum(amounts[k] for k in keys if k != "captured") != captured
        ):
            return {"state": "reconciliation_required", "reason": "SPLIT_NOT_CONSERVED",
                    "confirmation_verified": False, "bnb_custody": False}
        if intent_state != "finalized" or not payment_id:
            return {"state": "reconciliation_required", "reason": "SPLIT_WITHOUT_FINALITY",
                    "confirmation_verified": False, "bnb_custody": False}
    total_committed = 0
    totals = {"host": 0, "platform": 0, "developer": 0, "retained": 0, "refund": 0}
    for op in disbursements:
        kind, state = op.get("kind"), op.get("state")
        if kind not in totals or state not in ("reserved", "finalized", "failed"):
            return {"state": "reconciliation_required", "reason": "UNKNOWN_PAY_OPERATION",
                    "confirmation_verified": False, "bnb_custody": False}
        try:
            amount = int(op["amount"])
        except (ValueError, TypeError, KeyError):
            amount = -1
        if amount <= 0:
            return {"state": "reconciliation_required", "reason": "INVALID_DISBURSEMENT",
                    "confirmation_verified": False, "bnb_custody": False}
        if state != "failed":
            totals[kind] += amount
            total_committed += amount
    if (total_committed and captured is None) or (
        captured is not None and (
            total_committed > captured or
            any(totals[k] > int(split[k]) for k in
                ("host", "platform", "developer", "retained"))
        )
    ):
        return {"state": "reconciliation_required", "reason": "ECONOMIC_OVERALLOCATION",
                "confirmation_verified": False, "bnb_custody": False}
    return {
        "state": reservation_state,
        "reason": None,
        "confirmation_verified": reservation_state == "confirmed",
        "payment_finalized": intent_state == "finalized" and bool(payment_id),
        "captured_amount": str(captured) if captured is not None else None,
        "committed_amount": str(total_committed),
        "remaining_amount": str(captured - total_committed) if captured is not None else None,
        "refund_committed_amount": str(totals["refund"]),
        "pay_reconciliation_owner": "420Pay",
        "wallet_authorization_owner": "420Wallet",
        "bnb_custody": False,
    }
