"""R03.9 authenticated HTTP replay application (deploy only behind trusted TLS ingress).

Identity and transport claims are server-owned. A browser must never submit
verified=True flags. Commands are strictly non-regulated and idempotent.
"""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied
from .mobile_offline import OfflineQueue,identifier,MAX_ITEMS

@dataclass(frozen=True)
class ReplayRequest:
    method:str
    path:str
    bearer_token:str
    tenant_id:str
    device_id:str
    commands:list
    trusted_origin:bool
    trusted_device:bool
    trusted_csrf:bool

def handle_replay(*,request,identity,ledger,at=None):
    at=at or datetime.now(timezone.utc)
    if (not isinstance(request,ReplayRequest) or request.method!="POST"
        or request.path!="/private/v1/mobile/replay"
        or not request.trusted_origin or not request.trusted_device or not request.trusted_csrf
        or not request.bearer_token or at.tzinfo is None or not isinstance(request.commands,list)
        or len(request.commands)>MAX_ITEMS):
        raise Denied("untrusted replay ingress")
    tenant,device=identifier(request.tenant_id),identifier(request.device_id)
    # The identity adapter must validate bearer token, device proof and current
    # revocation against the canonical issuer, not a locally cached assertion.
    if identity.verify_replay(token=request.bearer_token,tenant_id=tenant,device_id=device,at=at) is not True:
        raise Denied("replay session revoked")
    queue=OfflineQueue(tenant_id=tenant,device_id=device)
    for c in request.commands:
        if not isinstance(c,dict) or set(c)!={"command_id","kind","opaque_ref","created_at"}:
            raise Denied("unexpected replay payload")
        created=c["created_at"]
        if not isinstance(created,datetime):raise Denied("invalid replay time")
        queue.enqueue(command_id=c["command_id"],kind=c["kind"],opaque_ref=c["opaque_ref"],at=created)
    class Revalidated:
        def verify_device(self,**kwargs):
            return identity.verify_replay(token=request.bearer_token,tenant_id=tenant,device_id=device,at=at) is True
    ready=queue.reconnect(issuer=Revalidated(),at=at)
    # The ledger owns unique (tenant,device,command_id) inserts transactionally.
    # It must return true only for committed new records, false for duplicates.
    # No external delivery/financial effects can be performed by this endpoint.
    results=[]
    for c in ready:
        inserted=ledger.record_once(tenant_id=tenant,device_id=device,command_id=c.command_id,
          kind=c.kind,opaque_ref=c.opaque_ref,at=at)
        if type(inserted) is not bool:raise Denied("replay ledger unavailable")
        results.append({"command_id":c.command_id,"status":"ACCEPTED" if inserted else "DUPLICATE"})
    return {"status":"OK","processed":results}
