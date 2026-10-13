"""R05.2 privacy and retention conflict boundaries. No implicit deletion or disclosure."""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied

PRIVATE_KEYS=frozenset({"address","street","postal_code","latitude","longitude","gps","coordinates","courier_id","recipient_id","identity_proof","phone","email","tracking","device_id"})
PUBLIC_KEYS=frozenset({"region_id","state","label","disclaimer","checkout_enabled","booking_enabled","handoff_type"})

def enforce_public_projection(*,projection):
 if not isinstance(projection,dict) or set(projection)!=PUBLIC_KEYS:
  raise Denied("public privacy schema mismatch")
 if any(key.lower() in PRIVATE_KEYS for key in projection):
  raise Denied("private field in public projection")
 if projection["checkout_enabled"] is not False or projection["booking_enabled"] is not False:
  raise Denied("public projection cannot authorize commerce")
 for key in ("region_id","state","label","disclaimer","handoff_type"):
  value=projection[key]
  if not isinstance(value,str) or len(value)>256 or any(ord(c)<32 for c in value):
   raise Denied("untrusted public projection value")
 return dict(projection)

@dataclass(frozen=True)
class RetentionDecision:
 tenant_id:str
 subject_ref:str
 record_ref:str
 purpose:str
 legal_hold:bool
 retention_until:datetime
 authorized_erase:bool
 decision_id:str
 issuer:str
 revoked:bool

def authorize_erasure(*,tenant_id,subject_ref,record_ref,signed_request,
                      authority,approved_issuers,at=None):
 at=at or datetime.now(timezone.utc)
 if (not isinstance(at,datetime) or at.tzinfo is None or
     any(not isinstance(v,str) or not v or len(v)>256 for v in
         (tenant_id,subject_ref,record_ref,signed_request)) or not approved_issuers):
  raise Denied("untrusted erasure request")
 try:
  decision=authority.verify_erasure(signed_request=signed_request,at=at)
  if (not isinstance(decision,RetentionDecision) or decision.tenant_id!=tenant_id
      or decision.subject_ref!=subject_ref or decision.record_ref!=record_ref
      or decision.issuer not in approved_issuers or not decision.decision_id
      or not decision.purpose or decision.revoked is not False
      or decision.authorized_erase is not True or decision.legal_hold is not False
      or not isinstance(decision.retention_until,datetime)
      or decision.retention_until.tzinfo is None or at<decision.retention_until):
   raise Denied("retention or legal hold blocks erasure")
  if authority.is_revoked(issuer=decision.issuer,decision_id=decision.decision_id,at=at) is not False:
   raise Denied("erasure authority withdrawn")
  return decision
 except Denied:raise
 except Exception as exc:raise Denied("retention authority unavailable") from exc
