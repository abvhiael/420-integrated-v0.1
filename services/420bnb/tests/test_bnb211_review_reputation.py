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
