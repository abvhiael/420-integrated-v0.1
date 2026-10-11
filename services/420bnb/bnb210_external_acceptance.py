"""BNB-2.10 live authority acceptance verifier; never creates approvals."""
import json,os,sys,re
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request,build_opener,HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*_):raise ValueError("redirect rejected")
def require_approval(record,now):
 required=("approval_id","approving_organization","independent_reviewer","approved_at","expires_at","scope","key_fingerprint")
 if not isinstance(record,dict) or any(not isinstance(record.get(k),str) or not record[k].strip() for k in required):raise ValueError("approval evidence incomplete")
 if record["approving_organization"]==record["independent_reviewer"]:raise ValueError("self approval")
 if not re.fullmatch("[a-fA-F0-9]{64}",record["key_fingerprint"]):raise ValueError("invalid key fingerprint")
 start=datetime.fromisoformat(record["approved_at"].replace("Z","+00:00"))
 end=datetime.fromisoformat(record["expires_at"].replace("Z","+00:00"))
 if not start.tzinfo or not end.tzinfo or not start<=now<end:raise ValueError("inactive approval")
def safe_base(raw):
 p=urlparse(raw)
 if p.scheme!="https" or not p.hostname or p.username or p.password or p.query or p.fragment or p.path not in ("","/"):raise ValueError("untrusted URL")
 return raw.rstrip("/")
def probe(url):
 with build_opener(NoRedirect()).open(Request(url,headers={"Accept":"application/json","Cache-Control":"no-store"}),timeout=5) as response:
  if response.status!=200:raise ValueError("service unavailable")
  raw=response.read(262145)
  if len(raw)>262144:raise ValueError("oversized response")
  return json.loads(raw)
def evaluate(evidence,services,place_id,property_id,request=probe):
 errors=[]
 now=datetime.now(timezone.utc)
 for group in ("location_authorization","jurisdiction_authorization","security_acceptance"):
  try:require_approval(evidence.get(group),now)
  except (TypeError,ValueError) as e:errors.append(group+": "+str(e))
 if not re.fullmatch("[A-Za-z0-9_-]{1,128}",place_id) or not re.fullmatch("[a-fA-F0-9-]{36}",property_id):errors.append("invalid target identifier")
 try:
  travel=safe_base(services["travel"]);bnb=safe_base(services["bnb"])
 except (KeyError,TypeError,ValueError) as e:errors.append("configuration: "+str(e))
 if errors:return errors
 try:
  public=request(travel+"/travel/api/v1/places")
  if public.get("state")!="ready" or sum(isinstance(p,dict) and p.get("id")==place_id for p in public.get("places",[]))!=1:raise ValueError("public place absent or ambiguous")
  response=request(bnb+"/v1/bnb/travel/authorized?place_id="+place_id)
  if response.get("version")!="bnb-travel-authorized/v1" or response.get("nonbinding") is not True or response.get("transaction_enabled") is not False:raise ValueError("unsafe listing contract")
  listings=response.get("listings")
  if not isinstance(listings,list) or sum(isinstance(x,dict) and x.get("property_id")==property_id for x in listings)!=1:raise ValueError("approved listing missing")
  if any("private_address" in x or "host_subject" in x for x in listings):raise ValueError("private disclosure")
 except (ValueError,TypeError,KeyError,OSError) as e:errors.append("live_cross_service: "+str(e))
 return errors
if __name__=="__main__":
 if len(sys.argv)!=4:
  print("usage: bnb210_external_acceptance.py approval-evidence.json place_id property_uuid",file=sys.stderr);sys.exit(2)
 evidence=json.loads(Path(sys.argv[1]).read_text())
 errors=evaluate(evidence,{"travel":os.getenv("BNB_TRAVEL_PUBLIC_URL",""),"bnb":os.getenv("TRAVEL_BNB_PUBLIC_URL","")},sys.argv[2],sys.argv[3])
 print(json.dumps({"gate":"BNB-2.10","probes_passed":not errors,"operator_approval_verified":False,"errors":errors},sort_keys=True))
 sys.exit(1 if errors else 0)
