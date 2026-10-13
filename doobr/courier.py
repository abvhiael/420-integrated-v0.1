"""R02.4 courier eligibility: external authoritative credentials; deny by default.

420Compliance owns jurisdiction policy. This module does not infer age, licence
or training approval from wallet ownership or self-reported documents.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
from .auth import Denied

CARRIER_CLASSES=frozenset({"LICENSEE_EMPLOYEE","DELIVERY_PERSON","COMMON_CARRIER"})
CREDENTIAL_KINDS=frozenset({"IDENTITY","COURIER_AUTHORITY","TRAINING","VEHICLE"})
@dataclass(frozen=True)
class CourierCredential:
    tenant_id: str
    courier_id: str
    credential_id: str
    kind: str
    carrier_class: str
    issuer: str
    evidence_ref: str
    valid_from: datetime
    valid_until: datetime
    revoked: bool
    vehicle_ref: str | None = None

@dataclass(frozen=True)
class CourierEligibility:
    tenant_id: str
    courier_id: str
    carrier_class: str
    vehicle_ref: str | None
    credential_ids: tuple[str,...]
    checked_at: datetime

class CredentialAuthority(Protocol):
    def verify_current(self, credential: CourierCredential, at: datetime) -> bool: ...

class CourierPolicy(Protocol):
    def required_credentials(self, carrier_class: str, jurisdiction: str, at: datetime) -> frozenset[str]: ...

def verify_courier(*, tenant_id: str, courier_id: str, carrier_class: str,
                   jurisdiction: str, vehicle_ref: str | None,
                   credentials: list[CourierCredential],
                   authority: CredentialAuthority, policy: CourierPolicy,
                   at: datetime | None = None) -> CourierEligibility:
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or not tenant_id or not courier_id or not jurisdiction
        or carrier_class not in CARRIER_CLASSES or not isinstance(credentials,list)):
        raise Denied("invalid courier eligibility context")
    try:
        required=policy.required_credentials(carrier_class,jurisdiction,at)
        if (type(required) is not frozenset or not required
            or not required.issubset(CREDENTIAL_KINDS) or "IDENTITY" not in required
            or "COURIER_AUTHORITY" not in required or "TRAINING" not in required
            or ("VEHICLE" in required and not vehicle_ref)):
            raise Denied("approved courier policy unavailable or incomplete")
        verified={}
        for credential in credentials:
            if not isinstance(credential,CourierCredential):
                raise Denied("malformed credential")
            if (credential.tenant_id!=tenant_id or credential.courier_id!=courier_id
                or credential.carrier_class!=carrier_class or credential.kind not in required
                or not all((credential.credential_id,credential.issuer,credential.evidence_ref))
                or credential.revoked or credential.valid_from.tzinfo is None
                or credential.valid_until.tzinfo is None
                or not credential.valid_from<=at<credential.valid_until
                or (credential.kind=="VEHICLE" and credential.vehicle_ref!=vehicle_ref)
                or credential.kind in verified):
                raise Denied("invalid, expired, revoked or duplicated courier evidence")
            if authority.verify_current(credential,at) is not True:
                raise Denied("independent credential issuer denied")
            verified[credential.kind]=credential.credential_id
        if set(verified)!=set(required):
            raise Denied("missing required courier credentials")
        return CourierEligibility(tenant_id,courier_id,carrier_class,vehicle_ref,
                                  tuple(sorted(verified.values())),at)
    except Denied:
        raise
    except Exception as exc:
        raise Denied("courier issuer or compliance policy unavailable") from exc
