"""R04.6 independent canonical Identity/Verify/Registry provenance decision.
An adapter result is not a locally issued credential or a regulated license.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from .auth import Denied

@dataclass(frozen=True)
class Provenance:
    tenant_id:str
    subject_ref:str
    credential_id:str
    identity_issuer:str
    verify_issuer:str
    registry_ref:str
    category:str
    issued_at:datetime
    expires_at:datetime
    revoked:bool
    evidence_ref:str

def verify_provenance(*,tenant_id,subject_ref,credential_id,signed_credential,
                      identity,verify,registry,trusted_identity_issuers,
                      trusted_verify_issuers,approved_categories,now=None):
    now=now or datetime.now(timezone.utc)
    if (not isinstance(now,datetime) or now.tzinfo is None or
        not all(isinstance(x,str) and 1<=len(x)<=256 for x in
          (tenant_id,subject_ref,credential_id,signed_credential)) or
        not trusted_identity_issuers or not trusted_verify_issuers or
        not approved_categories):
        raise Denied("invalid provenance verification context")
    try:
        # Authenticity, current issuer keys, audience and delegation MUST be
        # independently established by these canonical trusted clients.
        evidence=verify.verify_credential(signed_credential=signed_credential,
                            tenant_id=tenant_id,subject_ref=subject_ref,at=now)
        if not isinstance(evidence,Provenance):raise Denied("untrusted provenance")
        if (evidence.tenant_id!=tenant_id or evidence.subject_ref!=subject_ref
            or evidence.credential_id!=credential_id
            or evidence.identity_issuer not in trusted_identity_issuers
            or evidence.verify_issuer not in trusted_verify_issuers
            or evidence.category not in approved_categories
            or evidence.revoked is not False or not evidence.registry_ref
            or not evidence.evidence_ref
            or any(not isinstance(x,str) or len(x)>256 for x in (
                evidence.identity_issuer,evidence.verify_issuer,evidence.registry_ref,
                evidence.evidence_ref,evidence.category))
            or not isinstance(evidence.issued_at,datetime)
            or not isinstance(evidence.expires_at,datetime)
            or evidence.issued_at.tzinfo is None or evidence.expires_at.tzinfo is None
            or not evidence.issued_at<=now<evidence.expires_at):
            raise Denied("provenance expired revoked or mismatched")
        if identity.verify_binding(tenant_id=tenant_id,subject_ref=subject_ref,
              issuer=evidence.identity_issuer,credential_id=credential_id,at=now) is not True:
            raise Denied("canonical identity binding revoked")
        if registry.verify_binding(tenant_id=tenant_id,subject_ref=subject_ref,
              registry_ref=evidence.registry_ref,credential_id=credential_id,at=now) is not True:
            raise Denied("canonical registry binding revoked")
        if verify.is_revoked(issuer=evidence.verify_issuer,
                           credential_id=credential_id,at=now) is not False:
            raise Denied("canonical credential revoked")
        return evidence
    except Denied:raise
    except Exception as exc:raise Denied("canonical provenance authority unavailable") from exc
