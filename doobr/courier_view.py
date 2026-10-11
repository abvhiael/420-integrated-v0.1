"""R03.4 trusted courier credential status; public enrollment and availability remain disabled."""
from dataclasses import dataclass
from datetime import datetime, timezone
from .auth import Denied,Permission,authorize
from .courier import verify_courier

@dataclass(frozen=True)
class CourierStatus:
    enrollment: str
    credentials: str
    availability: str
    checked_at: datetime

def read_courier_status(*,identity_issuer,session_store,signed_token,tenant_id,courier_id,
                        jurisdiction,carrier_class,vehicle_ref,credentials,credential_authority,
                        courier_policy,at=None):
    at=at or datetime.now(timezone.utc)
    session=authorize(issuer=identity_issuer,store=session_store,signed_token=signed_token,
       tenant_id=tenant_id,permission=Permission("COURIER","READ_ASSIGNED","courier:"+courier_id),now=at)
    if session.actor_id!=courier_id:raise Denied("courier ownership mismatch")
    verified=verify_courier(tenant_id=tenant_id,courier_id=courier_id,
       carrier_class=carrier_class,jurisdiction=jurisdiction,vehicle_ref=vehicle_ref,
       credentials=credentials,authority=credential_authority,policy=courier_policy,at=at)
    if verified.checked_at!=at:raise Denied("stale courier verification")
    # No role or eligibility check alone can put a courier online:
    # online requires independent live region, GPS permission and trusted presence path.
    return CourierStatus("REQUIRES_OPERATOR_APPROVAL","VERIFIED","OFFLINE",at)
