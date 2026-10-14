"""R03.10 coarse read-only 420Travel presence projection; always no checkout.

420Travel is a consumer of a privacy-safe signed aggregate, never an authority.
"""
from datetime import datetime,timezone,timedelta
from urllib.parse import urlparse
from .auth import Denied
STATES=frozenset({"AVAILABLE","LIMITED","UNAVAILABLE","UNKNOWN"})
MAX_AGE=timedelta(minutes=5)

def presence_card(*,record,verifier,at=None):
 at=at or datetime.now(timezone.utc)
 if at.tzinfo is None or not isinstance(record,dict):
  raise Denied("invalid travel projection")
 required={"region_id","state","issued_at","expires_at","privacy_threshold_met","signature"}
 if set(record)!=required:raise Denied("projection must contain only coarse fields")
 region=record["region_id"]
 if (not isinstance(region,str) or not 3<=len(region)<=64
     or not all(x.isalnum() or x in "-_" for x in region)
     or record["state"] not in STATES
     or record["privacy_threshold_met"] is not True):
  raise Denied("unsafe coarse projection")
 issued,expires=record["issued_at"],record["expires_at"]
 if (not isinstance(issued,datetime) or not isinstance(expires,datetime)
     or issued.tzinfo is None or expires.tzinfo is None
     or issued>at or at>=expires or expires-issued>MAX_AGE):
  raise Denied("stale presence")
 if verifier.verify_projection(record=record,at=at) is not True:
  raise Denied("unverified coarse projection")
 return {"region_id":region,"state":record["state"],
  "label":"DOOBr regional presence (informational only)",
  "disclaimer":"Service presence does not establish legal delivery eligibility.",
  "checkout_enabled":False,"booking_enabled":False,
  "handoff_type":"EXTERNAL_DEEP_LINK"}

def deep_link(*,url,allowed_host="doobr.420integrated.org"):
 if not isinstance(url,str) or len(url)>512:raise Denied("invalid deep link")
 parsed=urlparse(url)
 if (parsed.scheme!="https" or parsed.hostname!=allowed_host or parsed.port is not None
     or parsed.username or parsed.password or parsed.query or parsed.fragment
     or parsed.path!="/coverage" or parsed.params):
  raise Denied("untrusted travel handoff")
 return "https://"+allowed_host+"/coverage"

def block_checkout(*_args,**_kwargs):
 raise Denied("420Travel DOOBr checkout permanently disabled")
