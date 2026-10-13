"""R03.9 bounded reconnect queue and fail-closed mobile revocation.

No GPS, delivery/financial, user-identifying or regulatory commands can be queued.
Queue instances are volatile; a restart requires fresh trusted identity and state.
"""
from dataclasses import dataclass
from datetime import datetime,timedelta,timezone
from uuid import UUID
from .auth import Denied
ALLOWED=frozenset({"REFRESH_STATUS","ACK_OPAQUE_NOTIFICATION"})
MAX_ITEMS=32
TTL=timedelta(minutes=5)

def identifier(value):
    try:return str(UUID(value))
    except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid mobile id") from exc

@dataclass(frozen=True)
class Pending:
    command_id:str
    kind:str
    opaque_ref:str
    created_at:datetime
    tenant_id:str
    device_id:str

class OfflineQueue:
    def __init__(self,*,tenant_id,device_id):
        self.tenant_id=identifier(tenant_id)
        self.device_id=identifier(device_id)
        self.items=[]
        self.revoked=False
        self.permission_denied=False

    def enqueue(self,*,command_id,kind,opaque_ref,at=None):
        at=at or datetime.now(timezone.utc)
        if self.revoked or self.permission_denied:raise Denied("mobile queue disabled")
        if (type(kind) is not str or kind not in ALLOWED or type(opaque_ref) is not str
            or not 8<=len(opaque_ref)<=128 or not opaque_ref.isascii()
            or any(ch.isspace() for ch in opaque_ref) or at.tzinfo is None
            or len(self.items)>=MAX_ITEMS):
            raise Denied("invalid offline command")
        command_id=identifier(command_id)
        if any(x.command_id==command_id for x in self.items):raise Denied("duplicate offline command")
        self.items.append(Pending(command_id,kind,opaque_ref,at,self.tenant_id,self.device_id))
        return "QUEUED"

    def revoke(self):
        self.revoked=True
        self.items.clear()
        return "REVOKED"

    def location_permission_failed(self):
        self.permission_denied=True
        self.items.clear()
        return "PERMISSION_DENIED"

    def reconnect(self,*,issuer,at=None):
        """The independently trusted issuer must validate revocation and device scope each time.

        Only the returned records may be offered to a separate authenticated,
        idempotent server dispatch; this function deliberately does not send.
        """
        at=at or datetime.now(timezone.utc)
        if at.tzinfo is None or self.revoked or self.permission_denied:
            self.items.clear()
            raise Denied("mobile session unavailable")
        try:
            trusted=issuer.verify_device(tenant_id=self.tenant_id,device_id=self.device_id,at=at)
            if trusted is not True:raise Denied("device revoked or offline")
        except Exception as exc:
            self.items.clear()
            raise Denied("reconnect authority unavailable") from exc
        ready=[x for x in self.items if x.created_at<=at and at-x.created_at<=TTL]
        self.items.clear()
        return ready
