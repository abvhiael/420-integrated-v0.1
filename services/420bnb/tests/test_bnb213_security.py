"""BNB-2.13: adversarial HTTP trust-boundary tests.

Bearer-authenticated API uses no browser cookies; third-party web pages cannot
provide authorization. Signed financial ingress requires its own independent key.
"""
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

spec=importlib.util.spec_from_file_location("bnb213_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.mark.parametrize("method,path,body",[
    ("post","/v1/bnb/booking-requests",{"hold_id":str(uuid4()),"request_type":"instant"}),
    ("post","/v1/bnb/abuse-reports",{"target_type":"review","target_id":str(uuid4()),"reason":"fraud"}),
    ("post","/v1/bnb/reviews/"+str(uuid4())+"/host-response",{"body":"unsafe request"}),
])
def test_cross_origin_cookie_only_cannot_authorize_mutations(monkeypatch,method,path,body):
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("anonymous DB access")))
    resp=getattr(client,method)(path,json=body,headers={
        "origin":"https://evil.example","cookie":"bnb_session=forged",
        "idempotency-key":"test-idempotency-123"})
    assert resp.status_code in (401,403),resp.text

@pytest.mark.parametrize("path,payload,header",[
    ("/v1/bnb/internal/pay/finality",{},"x-pay-authority-proof"),
    ("/v1/bnb/internal/abuse-reports/"+str(uuid4())+"/decision",{"decision":"accepted"},"x-guest-review-proof"),
])
def test_forged_internal_headers_do_not_bypass_signature(monkeypatch,path,payload,header):
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("unsigned DB access")))
    r=client.post(path,json=payload,headers={header:"self-attested", "x-authenticated-role":"administrator"})
    assert r.status_code in (401,403,422,503),r.text

def test_signed_reputation_cross_property_scope_denied_before_db(monkeypatch):
    a,b=uuid4(),uuid4()
    monkeypatch.setattr(api,"verify_authority",lambda *_:{"property_id":str(b)})
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("foreign property DB access")))
    r=client.get(f"/v1/bnb/internal/reputation/verified-reviews/{a}",headers={"x-reputation-proof":"signed"})
    assert r.status_code==403,r.text

def test_public_projection_cannot_return_private_fields(monkeypatch):
    class Cursor:
        def execute(self,sql,args):
            assert "private_address" not in sql
            assert "guest_subject" not in sql
            return self
        def fetchall(self):return []
    class Conn:
        def __enter__(self):return Cursor()
        def __exit__(self,*_):return False
    monkeypatch.setattr(api,"db",lambda:Conn())
    r=client.get("/v1/bnb/listings")
    assert r.status_code==200,r.text
    assert "private_address" not in r.text
    assert "guest_subject" not in r.text

def test_api_security_headers_on_success_and_denial(monkeypatch):
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("no DB needed")))
    for response in (client.get("/health/live"),client.get("/v1/bnb/reservations/"+str(uuid4()))):
        assert response.headers["x-content-type-options"]=="nosniff"
        assert response.headers["x-frame-options"]=="DENY"
        assert response.headers["referrer-policy"]=="no-referrer"
        assert response.headers["cache-control"].startswith("no-store")
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]
