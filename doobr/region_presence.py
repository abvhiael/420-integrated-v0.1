"""R02.5 privacy-safe regional projection; never accepts device GPS for public output.

Region geometry is resolved separately by a tenant-scoped PostGIS authority.
Policy is evaluated independently by 420Compliance and MUST fail closed.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol
from .auth import Denied

PUBLIC_STATES=frozenset({"AVAILABLE","LIMITED","UNAVAILABLE","UNKNOWN"})

@dataclass(frozen=True)
class Presence:
    tenant_id: str
    courier_id: str
    region_id: str
    capacity: int
    updated_at: datetime
    eligible: bool

@dataclass(frozen=True)
class RegionPolicy:
    region_id: str
    approved: bool
    version: str
    expires_at: datetime
    anonymity_floor: int
    limited_capacity_floor: int

@dataclass(frozen=True)
class PublicRegion:
    region_code: str
    availability: str
    expires_at: str
    policy_version: str

class RegionalPolicyAuthority(Protocol):
    def verify(self, *, tenant_id: str, region_id: str, at: datetime) -> RegionPolicy: ...

def project_region(*, tenant_id: str, region_id: str, region_code: str,
                   presence: list[Presence], policy_authority: RegionalPolicyAuthority,
                   at: datetime | None = None, freshness_seconds: int = 90,
                   ttl_seconds: int = 30) -> PublicRegion:
    """Output only coarse region and enum, never counts, identities or geometry."""
    at=at or datetime.now(timezone.utc)
    if (at.tzinfo is None or not tenant_id or not region_id or not region_code
        or not isinstance(presence,list) or not 1<=freshness_seconds<=300
        or not 1<=ttl_seconds<=60):
        raise Denied("invalid regional projection context")
    try:
        p=policy_authority.verify(tenant_id=tenant_id,region_id=region_id,at=at)
        if (not isinstance(p,RegionPolicy) or not p.approved
            or p.region_id!=region_id or not p.version or p.expires_at.tzinfo is None
            or p.expires_at<=at or p.anonymity_floor<3 or p.limited_capacity_floor<1):
            raise Denied("unapproved compliance policy")
        unique=set()
        valid=[]
        for entry in presence:
            if (not isinstance(entry,Presence) or entry.tenant_id!=tenant_id
                or entry.region_id!=region_id or not entry.courier_id
                or entry.courier_id in unique or entry.updated_at.tzinfo is None
                or entry.updated_at>at or entry.capacity<0):
                raise Denied("invalid or duplicate private presence")
            unique.add(entry.courier_id)
            if entry.eligible and at-entry.updated_at<=timedelta(seconds=freshness_seconds):
                valid.append(entry)
        # No population disclosed below anonymity threshold; never publish zero
        # derived from zero couriers, avoiding occupancy inference.
        if len(valid)<p.anonymity_floor:
            state="UNKNOWN"
        elif sum(min(e.capacity,100) for e in valid)==0:
            state="UNAVAILABLE"
        elif sum(min(e.capacity,100) for e in valid)<p.limited_capacity_floor:
            state="LIMITED"
        else:
            state="AVAILABLE"
        expiry=min(p.expires_at,at+timedelta(seconds=ttl_seconds))
        return PublicRegion(region_code,state,expiry.isoformat(),p.version)
    except Denied:
        raise
    except Exception as exc:
        raise Denied("regional policy authority unavailable") from exc
