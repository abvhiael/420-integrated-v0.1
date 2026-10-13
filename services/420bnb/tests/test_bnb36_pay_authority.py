"""BNB-3.6 Pay authority verifier and non-custodial failure boundaries."""
import hashlib
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException

spec = importlib.util.spec_from_file_location("bnb36_pay", Path(__file__).resolve().parents[1] / "api.py")
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


def test_pay_proof_must_be_present_before_database_access(monkeypatch):
    monkeypatch.setattr(api, "db", lambda: (_ for _ in ()).throw(AssertionError("db accessed")))
    payload = api.PayFinalityInput(
        reservation_id=uuid4(), intent_id=uuid4(), pay_invoice_id="invoice",
        pay_payment_id="payment", receipt_hash="a" * 64, chain_id=420,
        asset="native:$420", asset_amount="100", merchant_id="merchant",
        payout_controller="controller", finality="FINALIZED",
    )
    with pytest.raises(HTTPException) as exc:
        api.ingest_pay_finality(payload, None)
    assert exc.value.status_code == 401
    assert exc.value.detail == "PAY_PROOF_REQUIRED"


@pytest.mark.parametrize("change,expected", [
    ({"authority": "420BnB"}, "CANONICAL_PAY_AUTHORITY_REQUIRED"),
    ({"registry_version": ""}, "CANONICAL_PAY_AUTHORITY_REQUIRED"),
    ({"payload_hash": "0" * 64}, "PAY_PAYLOAD_MISMATCH"),
])
def test_pay_proof_rejects_wrong_provenance_before_financial_mutation(monkeypatch, change, expected):
    payload = api.PayFinalityInput(
        reservation_id=uuid4(), intent_id=uuid4(), pay_invoice_id="invoice",
        pay_payment_id="payment", receipt_hash="b" * 64, chain_id=420,
        asset="native:$420", asset_amount="100", merchant_id="merchant",
        payout_controller="controller", finality="FINALIZED",
    )
    claims = {"authority": "420Pay", "registry_version": "1",
              "payload_hash": hashlib.sha256(payload.model_dump_json().encode()).hexdigest()}
    claims.update(change)
    monkeypatch.setattr(api, "verify_authority", lambda *args: claims)
    monkeypatch.setattr(api, "db", lambda: (_ for _ in ()).throw(AssertionError("db accessed")))
    with pytest.raises(HTTPException) as exc:
        api.ingest_pay_finality(payload, "test-only-signed-proof")
    assert exc.value.status_code == 403
    assert exc.value.detail == expected
