"""R03.7 private operator/safety/compliance console access and dual-control gate.

Decision verification does not execute orders or override 420Compliance.
No untrusted client, same actor, expired evidence or missing external authority
can approve a privileged operation.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from uuid import UUID
from .auth import Denied,Permission,authorize

ALLOWED=frozenset({"INCIDENT_ESCALATION","SAFETY_HOLD","COMPLIANCE_REVIEW"})
@dataclass(frozen=True)
class ApprovedReview:
    tenant_id:str
    case_id:str
    purpose:str
    requester_id:str
    approver_id:str
    evidence_ref:str

def _uuid(v):
    try:return str(UUID(v))
    except (ValueError,TypeError,AttributeError) as exc:raise Denied("invalid review identity") from exc

def review_dual_control(*,issuer,store,requester_token,approver_token,tenant_id,case_id,
                        purpose,evidence_ref,authority,at=None):
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or purpose not in ALLOWED or
        not isinstance(evidence_ref,str) or not 1<=len(evidence_ref)<=256 or
        requester_token==approver_token):
        raise Denied("invalid dual-control request")
    tenant_id,case_id=map(_uuid,(tenant_id,case_id))
    permission=Permission("OPERATOR","ESCALATE_INCIDENT","incident:"+case_id)
    requester=authorize(issuer=issuer,store=store,signed_token=requester_token,tenant_id=tenant_id,permission=permission,now=at)
    approver=authorize(issuer=issuer,store=store,signed_token=approver_token,tenant_id=tenant_id,permission=permission,now=at)
    one,two=_uuid(requester.actor_id),_uuid(approver.actor_id)
    if one==two or requester.subject==approver.subject or requester.token_id==approver.token_id:
        raise Denied("two independent actors required")
    try:
        if authority.verify_review(tenant_id=tenant_id,case_id=case_id,purpose=purpose,
            requester_id=one,approver_id=two,evidence_ref=evidence_ref,at=at) is not True:
            raise Denied("independent review authority denied")
    except Denied:raise
    except Exception as exc:raise Denied("review authority unavailable") from exc
    return ApprovedReview(tenant_id,case_id,purpose,one,two,evidence_ref)
