"""BNB-4.6 deterministic saga and economic boundary tests."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "bnb_booking_saga", Path(__file__).resolve().parents[1] / "booking_saga.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
project = module.project_saga

BASE = dict(reservation_state="confirmed", hold_state="confirmed",
            intent_state="finalized", payment_id="pay-1",
            split=dict(captured=100, host=75, platform=15, developer=5, retained=5),
            disbursements=[])


def test_valid_conserved_projection_is_not_a_payment_authority():
    result = project(**BASE)
    assert result["confirmation_verified"] is True
    assert result["remaining_amount"] == "100"
    assert result["bnb_custody"] is False
    assert result["pay_reconciliation_owner"] == "420Pay"


def test_overallocation_and_invalid_splits_fail_closed():
    bad = dict(BASE, disbursements=[dict(kind="host", amount=76, state="reserved")])
    assert project(**bad)["reason"] == "ECONOMIC_OVERALLOCATION"
    assert project(**dict(BASE, split=dict(BASE["split"], host=76)))["reason"] == "SPLIT_NOT_CONSERVED"


def test_conflicting_finality_and_late_receipt_fail_closed():
    assert project(**dict(BASE, intent_state="pending"))["reason"] == "CONFIRMATION_EVIDENCE_MISMATCH"
    assert project(**dict(BASE, reservation_state="cancelled"))["reason"] == "LATE_FINALITY_RECOVERY"
    assert project(**dict(BASE, reservation_state="recovery_required"))["reason"] == "PAY_RECOVERY_REQUIRED"


def test_duplicate_failed_disbursement_does_not_allocate():
    result = project(**dict(BASE, disbursements=[
        dict(kind="host", amount=70, state="finalized"),
        dict(kind="refund", amount=30, state="failed")]))
    assert result["committed_amount"] == "70"
    assert result["remaining_amount"] == "30"


def test_absent_pay_evidence_does_not_confirm():
    result = project(reservation_state="payment_pending", hold_state="held",
                     intent_state=None, payment_id=None, split=None, disbursements=[])
    assert result["confirmation_verified"] is False
    assert result["captured_amount"] is None


def test_unknown_state_and_operation_fail_closed():
    assert project(**dict(BASE, reservation_state="disputed"))["reason"] == "UNKNOWN_BOOKING_STATE"
    assert project(**dict(BASE, disbursements=[
        dict(kind="unknown", amount=1, state="reserved")]))["reason"] == "UNKNOWN_PAY_OPERATION"


def test_reorg_does_not_release_financial_or_inventory_authority():
    result = project(**dict(BASE, reservation_state="recovery_required",
                            intent_state="recovery_required"))
    assert result["reason"] == "PAY_RECOVERY_REQUIRED"
    assert result["confirmation_verified"] is False
    assert result["bnb_custody"] is False


def test_refund_cannot_overdraw_captured_balance():
    result = project(**dict(BASE, disbursements=[
        dict(kind="refund", amount=101, state="reserved")]))
    assert result["reason"] == "ECONOMIC_OVERALLOCATION"


def test_disputed_payout_must_not_be_assumed_settled():
    result = project(**dict(BASE, disbursements=[
        dict(kind="host", amount=75, state="reserved")]))
    assert result["committed_amount"] == "75"
    assert result["remaining_amount"] == "25"
    assert result["confirmation_verified"] is True
