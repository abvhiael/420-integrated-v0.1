"""PB-1.10 privacy/leakage hardening.

Public and derived exports are deny-by-default. Sensitive PB membership/state never
becomes public merely because an internal field or derived projection exists.
"""
from dataclasses import dataclass
from typing import Mapping
from .types import VisibilityAudience
from puffbuddies.persistence.schema import TABLES,PUBLIC_TABLES,DERIVED_ONLY

class LeakageDenied(PermissionError): pass

# Classes that are never permitted on a public surface, including PUBLIC_EXPLICIT.
NEVER_PUBLIC_TABLES=frozenset(TABLES)
SENSITIVE_TOKENS=frozenset({
 "membership","relationship","match","like","pass","block","moderation","safety",
 "eligibility","lifecycle","precise_location","latitude","longitude","gps",
 "cannabis","wallet","identity","profile_id",
})
ALLOWED_AGGREGATE_KEYS=frozenset({"metric","bucket","count"})

@dataclass(frozen=True)
class PublicProjection:
    fields: Mapping[str,object]

def assert_no_public_table(table:str)->None:
    if table in TABLES or table in DERIVED_ONLY or table not in PUBLIC_TABLES:
        raise LeakageDenied("PB canonical/derived tables are not public export surfaces")

def public_field_allowed(*,audience:VisibilityAudience,field_key:str)->bool:
    # PB-0.15 PUBLIC_EXPLICIT is field-level intent, but protected categories remain
    # NEVER_PUBLIC. Membership/profile linkage is never inferred from wallet lookup.
    key=field_key.lower()
    if audience is not VisibilityAudience.PUBLIC_EXPLICIT:return False
    return not any(token in key for token in SENSITIVE_TOKENS)

def require_public_field(*,audience:VisibilityAudience,field_key:str)->None:
    if not public_field_allowed(audience=audience,field_key=field_key):
        raise LeakageDenied("field cannot be publicly disclosed")

def safe_aggregate(values:Mapping[str,object])->PublicProjection:
    keys=set(values)
    if not keys or not keys<=ALLOWED_AGGREGATE_KEYS: raise LeakageDenied("aggregate contains identifying/private dimensions")
    count=values.get("count")
    if not isinstance(count,int) or isinstance(count,bool) or count<2: raise LeakageDenied("aggregate cohort too small")
    return PublicProjection(dict(values))

def assert_derived_payload_minimal(payload:Mapping[str,object])->None:
    for key in payload:
        low=key.lower()
        if any(token in low for token in SENSITIVE_TOKENS):
            raise LeakageDenied("derived payload exposes protected PB state")

def wallet_lookup_membership_result(*args,**kwargs):
    raise LeakageDenied("wallet/address lookup must not reveal PuffBuddies membership")
