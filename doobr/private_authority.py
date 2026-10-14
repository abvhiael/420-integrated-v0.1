"""Strict independent authority boundary for private case decisions.

Production verification MUST be implemented by a separately operated canonical
authority; endpoint configuration alone is not proof. Never accept self-signed
decisions or trust browser claims. The default is hard denial.
"""
from .auth import Denied

class UnconnectedCaseAuthority:
    def verify_review(self,**kwargs):
        raise Denied("independent live case-review authority not connected")
    def verify_executed(self,**kwargs):
        raise Denied("independent live execution authority not connected")

class VerifiedAuthorityAdapter:
    """Inject a server-owned validator that checks signature, issuer/audience,
    expiry, revocation, case/tenant/action bindings and authorized policy version.
    """
    def __init__(self,verify_signed_decision):
        if not callable(verify_signed_decision):
            raise Denied("authority verifier unavailable")
        self._verify=verify_signed_decision
    def _check(self,kind,fields):
        required=("tenant_id","case_id","purpose","evidence_ref","at")
        if not all(fields.get(k) for k in required):
            raise Denied("incomplete canonical decision context")
        try:
            decision=self._verify(kind=kind,**fields)
        except Exception as exc:
            raise Denied("independent decision unavailable") from exc
        if decision is not True:
            raise Denied("independent decision denied")
        return True
    def verify_review(self,**kwargs):
        if not kwargs.get("requester_id") or not kwargs.get("approver_id") or kwargs["requester_id"]==kwargs["approver_id"]:
            raise Denied("independent actor proof absent")
        return self._check("REVIEW",kwargs)
    def verify_executed(self,**kwargs):
        return self._check("EXECUTED",kwargs)
