"""R03.7 private API adapter; invoke behind trusted TLS ingress, never public static hosting.

Caller supplies *server-verified* transport claims; no client-supplied tenant headers.
This adapter does not create a listening server or accept user-supplied authority.
"""
from dataclasses import dataclass
from .auth import Denied
from .console_cases import propose_case,approve_case,execute_case,close_case,uid

@dataclass(frozen=True)
class PrivateRequest:
    method:str
    path:str
    bearer_token:str
    tenant_id:str
    payload:dict
    origin_verified:bool
    csrf_verified:bool
    mfa_verified:bool

def handle_private_request(*,request,connect,issuer,store,authority):
    if (not isinstance(request,PrivateRequest) or not request.origin_verified
        or not request.csrf_verified or not request.mfa_verified
        or not isinstance(request.payload,dict) or not request.bearer_token
        or request.method!="POST"):
        raise Denied("private transport authentication missing")
    tenant=uid(request.tenant_id)
    data=request.payload
    if set(data)-{"case_id","event_id","purpose","proposal_ref","evidence_ref","expected_revision"}:
        raise Denied("unsupported private request fields")
    case=uid(data.get("case_id"))
    event=uid(data.get("event_id"))
    common=dict(connect=connect,issuer=issuer,store=store,token=request.bearer_token,
        tenant_id=tenant,case_id=case,event_id=event)
    if request.path=="/private/v1/cases/propose":
        return {"status":propose_case(**common,purpose=data.get("purpose"),
            proposal_ref=data.get("proposal_ref"),evidence_ref=data.get("evidence_ref"))}
    if request.path=="/private/v1/cases/approve":
        return {"status":approve_case(**common,expected_revision=data.get("expected_revision"),authority=authority)}
    if request.path=="/private/v1/cases/execute":
        return {"status":execute_case(**common,authority=authority)}
    if request.path in ("/private/v1/cases/reject","/private/v1/cases/expire"):
        operation="REJECT" if request.path.endswith("reject") else "EXPIRE"
        return {"status":close_case(**common,operation=operation,expected_revision=data.get("expected_revision"))}
    raise Denied("unknown private operation")
