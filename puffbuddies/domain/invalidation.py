"""PB-1.9 derived-state invalidation.

Derived surfaces carry canonical subject generations. Canonical private-state changes
produce explicit invalidation scopes; stale derived material is never authority.
"""
from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet
from puffbuddies.persistence.revocation import RevocationMarker,DerivedAuthorityToken,token_current

class DerivedSurface(str,Enum):
    DISCOVERY="DISCOVERY"; MATCHING="MATCHING"; MESSAGING_AUTH="MESSAGING_AUTH"
    VISIBILITY="VISIBILITY"; CACHE="CACHE"; INDEX="INDEX"; ANALYTICS="ANALYTICS"

ALL_DERIVED=frozenset(DerivedSurface)
class CanonicalChange(str,Enum):
    PROFILE="PROFILE"; PREFERENCES="PREFERENCES"; ELIGIBILITY="ELIGIBILITY"
    VISIBILITY="VISIBILITY"; RELATIONSHIP="RELATIONSHIP"; SAFETY="SAFETY"
    LIFECYCLE="LIFECYCLE"; LOCATION="LOCATION"; CANNABIS="CANNABIS"
    BLOCK="BLOCK"; UNMATCH="UNMATCH"; DELETE="DELETE"

_SCOPE={
 CanonicalChange.PROFILE:frozenset({DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.VISIBILITY,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.PREFERENCES:frozenset({DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.CACHE,DerivedSurface.ANALYTICS}),
 CanonicalChange.ELIGIBILITY:ALL_DERIVED,
 CanonicalChange.VISIBILITY:frozenset({DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.MESSAGING_AUTH,DerivedSurface.VISIBILITY,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.RELATIONSHIP:frozenset({DerivedSurface.MATCHING,DerivedSurface.MESSAGING_AUTH,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.SAFETY:ALL_DERIVED,
 CanonicalChange.LIFECYCLE:ALL_DERIVED,
 CanonicalChange.LOCATION:frozenset({DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.CANNABIS:frozenset({DerivedSurface.DISCOVERY,DerivedSurface.MATCHING,DerivedSurface.VISIBILITY,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.BLOCK:ALL_DERIVED,
 CanonicalChange.UNMATCH:frozenset({DerivedSurface.MATCHING,DerivedSurface.MESSAGING_AUTH,DerivedSurface.CACHE,DerivedSurface.INDEX,DerivedSurface.ANALYTICS}),
 CanonicalChange.DELETE:ALL_DERIVED,
}

@dataclass(frozen=True)
class Invalidation:
    subject_id:str
    generation:int
    change:CanonicalChange
    surfaces:FrozenSet[DerivedSurface]
    def __post_init__(self):
        if not self.subject_id or self.generation<1 or not self.surfaces:
            raise ValueError("bounded invalidation required")

def invalidation_for(marker:RevocationMarker,change:CanonicalChange)->Invalidation:
    surfaces=_SCOPE.get(change)
    if not surfaces: raise ValueError("unknown canonical change")
    return Invalidation(marker.subject_id,marker.generation,change,surfaces)

def derived_usable(surface:DerivedSurface,token:DerivedAuthorityToken,marker:RevocationMarker)->bool:
    # Generation is the universal stale-state boundary. Deletion-complete is terminal.
    return surface in ALL_DERIVED and token_current(token,marker)

def require_derived_usable(surface,token,marker)->None:
    if not derived_usable(surface,token,marker): raise PermissionError("stale/revoked derived state")

def affected(inv:Invalidation,surface:DerivedSurface)->bool:
    return surface in inv.surfaces
