"""BNB-4.6 deterministic noncustodial booking and economic reconciliation view.

All inputs are persisted 420BnB mirrors of independently authorized sources.
This module performs no payment, custody, refund, booking confirmation or mutation.
"""
from __future__ import annotations


def project_saga(*, reservation_state: str, hold_state: str,
                 intent_state: str | None, payment_id: str | None,
                 split: dict | None, disbursements: list[dict],
                 pay_failures: list[str] | None = None,
                 pay_cases: list[dict] | None = None) -> dict:
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
    # Independently Pay-attested failure evidence supersedes cached finality.
    failures = pay_failures or []
    allowed = {"declined", "provider_unavailable", "settlement_failed",
               "reorg", "finality_revoked"}
    if any(code not in allowed for code in failures):
        return {"state": "reconciliation_required", "reason": "UNKNOWN_PAY_FAILURE",
                "confirmation_verified": False, "bnb_custody": False}
    if "reorg" in failures or "finality_revoked" in failures:
        return {"state": "reconciliation_required", "reason": "PAY_FINALITY_REVOKED",
                "confirmation_verified": False, "bnb_custody": False}
    if failures and (intent_state == "finalized" or reservation_state == "confirmed"):
        return {"state": "reconciliation_required", "reason": "PAY_SETTLEMENT_DISPUTED",
                "confirmation_verified": False, "bnb_custody": False}
    # Newest Pay-authenticated case revision per case_id is supplied by API.
    # No BnB actor can open, resolve or release a case without a Pay proof.
    cases=pay_cases or []
    valid={"opened","refund_requested","resolved"}
    if any(case.get("state") not in valid or (
        case.get("state")=="resolved" and case.get("resolution") not in
        ("upheld","refund_completed")) for case in cases):
        return {"state": "reconciliation_required", "reason": "UNKNOWN_PAY_CASE",
                "confirmation_verified": False, "bnb_custody": False}
    open_cases=[case for case in cases if case["state"]!="resolved"]
    blocked_cases=[case for case in cases if not (
        case["state"]=="resolved" and
        case.get("resolution")=="upheld" and
        case.get("payout_release_authorized") is True)]
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
    finalized_total = 0
    refund_finalized = 0
    refund_reserved = 0
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
            if state == "finalized":
                finalized_total += amount
                if kind == "refund":
                    refund_finalized += amount
            elif kind == "refund":
                refund_reserved += amount
    if (total_committed and captured is None) or (
        captured is not None and (
            total_committed > captured or
            any(totals[k] > int(split[k]) for k in
                ("host", "platform", "developer", "retained"))
        )
    ):
        return {"state": "reconciliation_required", "reason": "ECONOMIC_OVERALLOCATION",
                "confirmation_verified": False, "bnb_custody": False}
    refund_phase=("refunded" if refund_finalized and
                  captured is not None and refund_finalized==captured else
                  "partially_refunded" if refund_finalized else
                  "refund_pending" if refund_reserved else reservation_state)
    saga_phase="disputed" if open_cases else refund_phase
    return {
        "state": saga_phase,
        "reason": ("PAY_CASE_PENDING" if open_cases else
                   "PAYOUT_FROZEN_AFTER_REFUND" if blocked_cases else None),
        "confirmation_verified": reservation_state == "confirmed" and not blocked_cases,
        "payment_finalized": intent_state == "finalized" and bool(payment_id),
        "captured_amount": str(captured) if captured is not None else None,
        "committed_amount": str(total_committed),
        "remaining_amount": str(captured - total_committed) if captured is not None else None,
        "refund_committed_amount": str(totals["refund"]),
        "refund_finalized_amount": str(refund_finalized),
        "refund_reserved_amount": str(refund_reserved),
        "payout_finalized_amount": str(finalized_total - refund_finalized),
        "payout_reserved_amount": str(total_committed - finalized_total - refund_reserved),
        "refund_status": ("finalized" if refund_finalized and not refund_reserved
                          else "partial_and_pending" if refund_finalized and refund_reserved
                          else "pending" if refund_reserved else "not_requested"),
        "dispute_status": ("provider_review_required" if failures else
                           "pay_case_pending" if open_cases else
                           "pay_case_resolved" if cases else "none"),
        "pay_case_count": len(cases),
        "saga_phase": saga_phase,
        "pay_failure_count": len(failures),
        "pay_reconciliation_owner": "420Pay",
        "wallet_authorization_owner": "420Wallet",
        "bnb_custody": False,
    }
