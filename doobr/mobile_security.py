"""R03.8 mobile client security contract shared by iOS and Android native shells.

Platform adapters must supply hardware-backed key proof, permission observations
and app lifecycle events. No client may grant legal operating authority.
"""
from dataclasses import dataclass
from datetime import datetime,timezone,timedelta
from .auth import Denied

@dataclass(frozen=True)
class DeviceState:
    platform:str
    hardware_key:bool
    key_attested:bool
    device_unlocked:bool
    push_permission:bool
    foreground_location:bool
    background_location:bool
    active_assignment:bool
    active_navigation:bool
    user_requested_tracking:bool
    tracking_grant_expires:datetime|None

def validate_device(state:DeviceState,*,at=None)->dict:
    at=at or datetime.now(timezone.utc)
    if not isinstance(state,DeviceState) or at.tzinfo is None or state.platform not in {"ios","android"}:
        raise Denied("unsupported mobile device context")
    flags=(state.hardware_key,state.key_attested,state.device_unlocked,state.push_permission,
       state.foreground_location,state.background_location,state.active_assignment,
       state.active_navigation,state.user_requested_tracking)
    if any(type(flag) is not bool for flag in flags):
        raise Denied("untrusted mobile permission flags")
    if not (state.hardware_key and state.key_attested and state.device_unlocked):
        raise Denied("trusted hardware-backed device key required")
    tracking=(state.active_assignment and state.active_navigation and state.user_requested_tracking
       and state.foreground_location and state.tracking_grant_expires is not None
       and state.tracking_grant_expires.tzinfo is not None
       and at<state.tracking_grant_expires<=at+timedelta(hours=12))
    return {"push_enabled":state.push_permission,"foreground_tracking":bool(tracking),
            "background_tracking":bool(tracking and state.background_location),
            "regulated_operations_enabled":False}

def validate_push_payload(payload:dict)->dict:
    """Notifications only carry opaque routing hints; never address/PII/location."""
    if not isinstance(payload,dict) or set(payload)!={"event","opaque_ref"}:
        raise Denied("invalid mobile push payload")
    if payload["event"] not in {"ASSIGNMENT_UPDATED","REVIEW_REQUIRED","SESSION_REVOKED"}:
        raise Denied("unknown notification event")
    ref=payload["opaque_ref"]
    if not isinstance(ref,str) or not 8<=len(ref)<=128 or not ref.isascii() or any(ch.isspace() for ch in ref):
        raise Denied("invalid opaque notification reference")
    return {"event":payload["event"],"opaque_ref":ref}
