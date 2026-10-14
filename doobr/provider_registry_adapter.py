"""R04.2 — approved provider credential/Registry reference adapter, off-chain only.

External verifier and Registry clients are injected trusted services, never caller claims.
No new token, contract, issuer, compliance policy, licensing or sale authority.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied

@dataclass(frozen=True)
class ProviderReference:
 tenant_id:str
 provider_id:str
 issuer:str
 credential_id:str
 registry_ref:str
 category:str
 valid_from:datetime
 valid_until:datetime
 revoked:bool
 approval_id:str

class ApprovedProviderAdapter:
 def __init__(self,*,authority,registry,allowed_issuers,allowed_categories):
  if not allowed_issuers or not allowed_categories:raise Denied("missing approved authority configuration")
  self.authority=authority
  self.registry=registry
  self.allowed_issuers=frozenset(allowed_issuers)
  self.allowed_categories=frozenset(allowed_categories)

 def verify_reference(self,*,tenant_id,provider_id,signed_evidence,at=None):
  at=at or datetime.now(timezone.utc)
  if (not isinstance(at,datetime) or at.tzinfo is None
    or not isinstance(tenant_id,str) or not tenant_id
    or not isinstance(provider_id,str) or not provider_id
    or not isinstance(signed_evidence,str) or not signed_evidence):
   raise Denied("invalid provider verification context")
  try:
   # Authority must independently verify signature, audience, expiry,
   # issuer trust, status and withdrawal using configured trust roots.
   ref=self.authority.verify_provider(signed_evidence=signed_evidence,at=at)
   if not isinstance(ref,ProviderReference):raise Denied("invalid signed reference")
   if (ref.tenant_id!=tenant_id or ref.provider_id!=provider_id
      or ref.issuer not in self.allowed_issuers
      or ref.category not in self.allowed_categories
      or ref.revoked is not False or not ref.approval_id
      or not ref.credential_id or not ref.registry_ref
      or any(not isinstance(x,str) or len(x)>256 for x in
             (ref.issuer,ref.credential_id,ref.registry_ref,ref.approval_id))
      or not isinstance(ref.valid_from,datetime)
      or not isinstance(ref.valid_until,datetime)
      or ref.valid_from.tzinfo is None or ref.valid_until.tzinfo is None
      or not(ref.valid_from<=at<ref.valid_until)):
    raise Denied("provider credential not approved")
   # Registry is authoritative for the current identity/credential binding,
   # expiry and revocation. Unknown, stale and unavailable fail closed.
   bound=self.registry.verify_binding(
    tenant_id=tenant_id,provider_id=provider_id,issuer=ref.issuer,
    credential_id=ref.credential_id,registry_ref=ref.registry_ref,at=at)
   if bound is not True:raise Denied("canonical registry binding missing")
   return ref
  except Denied:raise
  except Exception as exc:raise Denied("provider authority unavailable") from exc
