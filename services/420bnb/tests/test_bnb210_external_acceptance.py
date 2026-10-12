"""Production acceptance verifier must reject synthetic or incomplete authorities."""
import importlib.util
from pathlib import Path
from datetime import datetime,timedelta,timezone

path=Path(__file__).resolve().parents[1]/"bnb210_external_acceptance.py"
spec=importlib.util.spec_from_file_location("bnb210_external_acceptance",path)
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)

def valid_record():
 now=datetime.now(timezone.utc)
 item={"approval_id":"independent-reference","approving_organization":"approving-body","independent_reviewer":"external-reviewer","approved_at":(now-timedelta(minutes=5)).isoformat(),"expires_at":(now+timedelta(days=1)).isoformat(),"scope":"testnet/property","key_fingerprint":"a"*64}
 return {k:dict(item) for k in ("location_authorization","jurisdiction_authorization","security_acceptance")}

def test_missing_authority_cannot_pass():
 assert len(gate.evaluate({},{"travel":"https://travel.example","bnb":"https://bnb.example"},"place_1","aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))>=3

def test_live_public_place_and_filtered_listing_required():
 def fetch(url):
  if "/places" in url:return {"state":"ready","places":[{"id":"place_1"}]}
  return {"version":"bnb-travel-authorized/v1","nonbinding":True,"transaction_enabled":False,"listings":[{"property_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}]}
 args=(valid_record(),{"travel":"https://travel.example","bnb":"https://bnb.example"},"place_1","aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
 assert gate.evaluate(*args,request=fetch)==[]
 assert gate.evaluate(*args,request=lambda url:{"state":"empty","places":[]} if "/places" in url else fetch(url))
 assert gate.evaluate(*args,request=lambda url:{"version":"bnb-travel-authorized/v1","nonbinding":True,"transaction_enabled":True,"listings":[]} if "/authorized" in url else fetch(url))

def test_rejects_self_approval_and_http_sources():
 record=valid_record()
 record["location_authorization"]["independent_reviewer"]=record["location_authorization"]["approving_organization"]
 assert gate.evaluate(record,{"travel":"https://travel.example","bnb":"http://bnb.example"},"place_1","aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
