"""BNB-2.11 security boundary regressions."""
import importlib.util
from pathlib import Path
from fastapi.testclient import TestClient
import pytest
spec=importlib.util.spec_from_file_location("bnb211_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.mark.parametrize("endpoint,body",[
 ("/v1/bnb/reviews/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/host-response",{"body":"Thank you"}),
 ("/v1/bnb/abuse-reports",{"target_type":"review","target_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","reason":"fraud","detail":"Review disputed"}),
])
def test_authentication_required_before_reading_private_records(monkeypatch,endpoint,body):
 monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("unauthorized database access")))
 assert client.post(endpoint,json=body).status_code in (401,403)

def test_public_reputation_never_acts_as_score_authority(monkeypatch):
 class Cursor:
  index=0
  def execute(self,query,args):
   self.index+=1
   assert "private_address" not in query
   return self
  def fetchone(self):return ("published",)
  def fetchall(self):return []
 class Conn:
  def __enter__(self):return Cursor()
  def __exit__(self,*args):return False
 monkeypatch.setattr(api,"db",lambda:Conn())
 result=client.get("/v1/bnb/reputation/public/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
 assert result.status_code==200,result.text
 assert result.json()["reviews"]==[]
 assert result.json()["score_authority"]=="420Reputation"
 assert result.json()["verified_stay_only"] is True
 assert "no-store" in result.headers["cache-control"]

@pytest.mark.parametrize("rating",[0,6,True,"5"])
def test_review_rating_strictly_validated(rating):
 result=client.post("/v1/bnb/reservations/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/guest-review",json={"rating":rating,"body":"Appropriate stay review"})
 assert result.status_code==422

@pytest.mark.parametrize("endpoint,body",[
 ("/v1/bnb/internal/abuse-reports/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/decision",{"decision":"accepted"}),
 ("/v1/bnb/internal/host-responses/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/decision",{"decision":"approved"}),
 ("/v1/bnb/internal/reputation/export-receipt",{"review_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","revision":1,"external_reference":"external-123"}),
])
def test_no_internal_issuer_can_be_bypassed_by_request_body(monkeypatch,endpoint,body):
 monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("unsigned mutation accessed DB")))
 response=client.post(endpoint,json=body)
 assert response.status_code==401,response.text

def test_reputation_property_scope_enforced_before_database(monkeypatch):
 monkeypatch.setattr(api,"verify_authority",lambda *_:{"property_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"})
 monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("out-of-scope read")))
 response=client.get("/v1/bnb/internal/reputation/verified-reviews/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",headers={"x-reputation-proof":"signed-external-proof"})
 assert response.status_code==403

def test_abuse_report_scope_and_decision_checked_before_database(monkeypatch):
 monkeypatch.setattr(api,"verify_authority",lambda *_:{"report_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","decision":"accepted"})
 monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("mismatched decision read DB")))
 response=client.post("/v1/bnb/internal/abuse-reports/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/decision",
  headers={"x-guest-review-proof":"external-proof"},json={"decision":"accepted"})
 assert response.status_code==403
