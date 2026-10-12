"""R04.3 privacy-minimal delivery evidence commitment (off-chain only).

Hashes canonical opaque identifiers, not recipient names, GPS coordinates, address,
signature or photo. This is no proof of legal delivery or settlement authorization.
"""
import hashlib,json,re
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied

_HEX=re.compile(r"^[0-9a-f]{64}$")
@dataclass(frozen=True)
class DeliveryCommitment:
 version:str
 commitment:str
 source_digest:str
 event_kind:str
 occurred_at:str

def commit_delivery(*,event_kind,source_digest,tenant_ref,order_ref,evidence_ref,nonce,occurred_at):
 if (event_kind not in ("PICKUP","HANDOFF","RETURN") or
     not isinstance(source_digest,str) or not _HEX.fullmatch(source_digest) or
     not isinstance(occurred_at,datetime) or occurred_at.tzinfo is None or
     occurred_at.utcoffset().total_seconds()!=0):
  raise Denied("invalid canonical delivery evidence")
 for label,val in (("tenant",tenant_ref),("order",order_ref),("evidence",evidence_ref),("nonce",nonce)):
  if not isinstance(val,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{20,128}",val):
   raise Denied("invalid opaque reference or nonce")
 # No raw PII or location fields are accepted, stored or exported.
 canonical=json.dumps({"domain":"doobr.delivery-commitment.v1","event":event_kind,
  "tenant":tenant_ref,"order":order_ref,"evidence":evidence_ref,
  "source_digest":source_digest,"nonce":nonce,
  "time":occurred_at.isoformat(timespec="seconds")},sort_keys=True,separators=(",",":"))
 digest=hashlib.sha256(canonical.encode("utf-8")).hexdigest()
 return DeliveryCommitment("doobr.delivery-commitment.v1",digest,source_digest,
   event_kind,occurred_at.isoformat(timespec="seconds"))
