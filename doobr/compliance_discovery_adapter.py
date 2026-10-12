"""R04.7 trusted 420Compliance decision and privacy-safe discovery projection.
No local regulatory override and no booking/payment/location authority.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied
from .travel_card import presence_card

@dataclass(frozen=True)
class PolicyDecision:
 tenant_id:str
 provider_ref:str
 municipality:str
 policy_version:str
 decision_id:str
 evidence_ref:str
 issuer:str
 outcome:str
 valid_from:datetime
 expires_at:datetime
 revoked:bool

def require_compliance(*,tenant_id,provider_ref,municipality,signed_decision,
                       compliance,approved_issuers,now=None):
 now=now or datetime.now(timezone.utc)
 if (not isinstance(now,datetime) or now.tzinfo is None
  or not all(isinstance(s,str) and 1<=len(s)<=256 for s in
      (tenant_id,provider_ref,municipality,signed_decision))
  or not approved_issuers):
  raise Denied("invalid compliance decision context")
 try:
  decision=compliance.verify_decision(signed_decision=signed_decision,at=now)
  if (not isinstance(decision,PolicyDecision) or
      decision.tenant_id!=tenant_id or decision.provider_ref!=provider_ref or
      decision.municipality!=municipality or
      not decision.policy_version or not decision.decision_id or not decision.evidence_ref or
      decision.issuer not in approved_issuers or decision.outcome!="ALLOW" or
      decision.revoked is not False or
      not isinstance(decision.valid_from,datetime) or not isinstance(decision.expires_at,datetime) or
      decision.valid_from.tzinfo is None or decision.expires_at.tzinfo is None or
      not decision.valid_from<=now<decision.expires_at):
   raise Denied("420Compliance did not approve current scope")
  if compliance.is_revoked(issuer=decision.issuer,decision_id=decision.decision_id,at=now) is not False:
   raise Denied("420Compliance decision revoked")
  if compliance.verify_evidence(decision_id=decision.decision_id,
      evidence_ref=decision.evidence_ref,at=now) is not True:
   raise Denied("420Compliance evidence absent")
  return decision
 except Denied:raise
 except Exception as exc:raise Denied("420Compliance unavailable") from exc

def read_only_region(*,region_id,location,search,projection_verifier,at=None):
 """Canonical Location owns region validity, Search owns public discovery context.
 Never forward a caller-supplied exact pin, address or private courier presence.
 """
 at=at or datetime.now(timezone.utc)
 if (not isinstance(region_id,str) or not region_id or len(region_id)>64
      or not all(c.isalnum() or c in "-_" for c in region_id) or at.tzinfo is None):
  raise Denied("invalid discovery region")
 try:
  if location.verify_public_region(region_id=region_id,at=at) is not True:
   raise Denied("canonical region unavailable")
  if search.allow_public_region(region_id=region_id,at=at) is not True:
   raise Denied("canonical public discovery unavailable")
  signed=location.coarse_presence(region_id=region_id,at=at)
  if not isinstance(signed,dict) or signed.get("region_id")!=region_id:
   raise Denied("region projection mismatch")
  # Strict six-field allowlist, signature/freshness/privacy threshold in R03.10.
  return presence_card(record=signed,verifier=projection_verifier,at=at)
 except Denied:raise
 except Exception as exc:raise Denied("public discovery authority unavailable") from exc
