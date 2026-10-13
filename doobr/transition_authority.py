"""R05.5 per-transition authority refresh. This cannot override Compliance or Registry."""
from datetime import datetime,timezone
from .auth import Denied
from .compliance_discovery_adapter import require_compliance

def authorize_transition(*, tenant_id, provider_id, municipality, signed_provider,
                         signed_policy, provider_adapter, compliance, approved_policy_issuers,
                         emergency_authority, transition_ref, at=None):
 at=at or datetime.now(timezone.utc)
 if (not isinstance(at,datetime) or at.tzinfo is None
     or any(not isinstance(v,str) or not v or len(v)>256 for v in
         (tenant_id,provider_id,municipality,signed_provider,signed_policy,transition_ref))):
  raise Denied("invalid transition authority context")
 try:
  # An unknown response, including a missing or stale stop-feed, denies every transition.
  if emergency_authority.is_stopped(tenant_id=tenant_id,municipality=municipality,
                                   transition_ref=transition_ref,at=at) is not False:
   raise Denied("emergency stop active or indeterminate")
  provider=provider_adapter.verify_reference(tenant_id=tenant_id,provider_id=provider_id,
                                              signed_evidence=signed_provider,at=at)
  policy=require_compliance(tenant_id=tenant_id,provider_ref=provider_id,
                             municipality=municipality,signed_decision=signed_policy,
                             compliance=compliance,approved_issuers=approved_policy_issuers,now=at)
  # Recheck emergency stop after the potentially slow network validations.
  if emergency_authority.is_stopped(tenant_id=tenant_id,municipality=municipality,
                                   transition_ref=transition_ref,at=at) is not False:
   raise Denied("emergency stop changed during validation")
  # The canonical control plane must validate current version, not cached ALLOW.
  if compliance.is_current_policy(municipality=municipality,policy_version=policy.policy_version,
                                  at=at) is not True:
   raise Denied("policy changed mid-order")
  if emergency_authority.is_stopped(tenant_id=tenant_id,municipality=municipality,
                                   transition_ref=transition_ref,at=at) is not False:
   raise Denied("emergency stop changed before transition")
  return (provider,policy)
 except Denied:raise
 except Exception as exc:raise Denied("transition authority unavailable") from exc
