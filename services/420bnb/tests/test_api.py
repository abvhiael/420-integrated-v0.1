"""Negative runtime contract tests: no identity trust or payment claims."""
import importlib.util
import os
from pathlib import Path
from fastapi.testclient import TestClient

spec=importlib.util.spec_from_file_location("bnb_api",Path(__file__).resolve().parents[1]/"api.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
client=TestClient(mod.app)

def test_health():
    r=client.get("/health/live")
    assert r.status_code==200 and r.json()["status"]=="live"

def test_untrusted_identity_rejected(monkeypatch):
    monkeypatch.delenv("BNB_TRUSTED_IDENTITY_PROXY",raising=False)
    r=client.post("/v1/bnb/properties",headers={
        "x-authenticated-subject":"forged-host","x-authenticated-role":"host"},json={
        "title":"House","public_region":"Prairies","capacity":1,
        "nightly_minor":5000,"currency":"CAD"})
    assert r.status_code==401 and r.json()["detail"]=="UNAUTHORIZED"

def test_guest_hold_requires_explicit_idempotency():
    r=client.post("/v1/bnb/holds",json={
      "property_id":"00000000-0000-0000-0000-000000000000",
      "start":"2027-01-01T00:00:00Z","end":"2027-01-02T00:00:00Z",
      "units":1,"policy_snapshot":"strict"})
    assert r.status_code==422

def test_payment_always_disabled():
    for headers in ({},{"x-authenticated-subject":"admin","x-authenticated-role":"host"}):
        r=client.post("/v1/bnb/payments/intents",headers=headers)
        assert r.status_code==503
        assert r.json()["detail"]=="PAYMENT_UNAVAILABLE"

def test_private_address_not_public():
    import inspect
    src=inspect.getsource(mod.listings)
    assert "private_address" not in src
