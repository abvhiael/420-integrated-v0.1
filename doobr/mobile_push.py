"""R03.8 opaque mobile push registration and routing contract (non-operational).

Authoritative identity, device attestation, and 420Notifications must independently
verify claims; this module cannot authorize provider enrollment or GPS capture.
"""
from datetime import datetime,timezone,timedelta
from uuid import UUID
from .auth import Denied,Permission,authorize
from .mobile_security import validate_push_payload

def _uuid(value):
    try:return str(UUID(value))
    except (TypeError,ValueError,AttributeError) as exc:raise Denied("invalid device identity") from exc

def verify_registration(*,issuer,store,signed_token,tenant_id,device_id,
                        attestation,notification_authority,at=None):
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:raise Denied("invalid registration timestamp")
    tenant_id,device_id=map(_uuid,(tenant_id,device_id))
    session=authorize(issuer=issuer,store=store,signed_token=signed_token,tenant_id=tenant_id,
        permission=Permission("COURIER","MANAGE_LOCATION","device:"+device_id),now=at)
    if (attestation.verify(tenant_id=tenant_id,device_id=device_id,actor_id=session.actor_id,at=at) is not True
        or notification_authority.authorize_registration(tenant_id=tenant_id,
              device_id=device_id,actor_id=session.actor_id,at=at) is not True):
        raise Denied("independent device or push authorization denied")
    return {"device_id":device_id,"status":"ELIGIBLE_FOR_PROVIDER_REGISTRATION"}

def verify_delivery(*,payload,issued_at,expires_at,authority,at=None):
    at=at or datetime.now(timezone.utc)
    event=validate_push_payload(payload)
    if (at.tzinfo is None or issued_at.tzinfo is None or expires_at.tzinfo is None
        or issued_at>at or not at<expires_at<=issued_at+timedelta(hours=1)):
        raise Denied("stale push envelope")
    if authority.verify_push(event=event,issued_at=issued_at,expires_at=expires_at,at=at) is not True:
        raise Denied("push authority missing")
    return event
