"""PB-2.8 discovery/matching eligibility enforcement.

Provides the hard eligibility gate that later discovery/matching implementations must
consume. It does not implement ranking, recommendation generation, like/pass storage,
or reciprocal-match creation.
"""
from dataclasses import dataclass

from puffbuddies.domain.authorization import (
    AuthorizationContext, authorize_private_access, authorize_relationship_action,
)
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.invalidation import (
    DerivedSurface, require_derived_usable,
)
from puffbuddies.domain.types import EligibilityState, LifecycleState, VisibilityAudience
from puffbuddies.persistence.revocation import DerivedAuthorityToken, RevocationMarker

class DiscoveryMatchingEligibilityDenied(PermissionError):
    pass

@dataclass(frozen=True)
class DiscoveryMatchingPair:
    viewer: BoundEligibilityAuthorization
    candidate: BoundEligibilityAuthorization

def _ordinary_current(context: AuthorizationContext) -> bool:
    return (
        context.eligibility == EligibilityState.ELIGIBLE
        and context.lifecycle == LifecycleState.ACTIVE
        and not context.blocked
    )

def discovery_candidate_allowed(pair: DiscoveryMatchingPair) -> bool:
    # Both sides must still be current ordinary participants. Candidate visibility alone
    # cannot compensate for an ineligible viewer; ranking never outranks hard exclusions.
    return (
        _ordinary_current(pair.viewer.context)
        and _ordinary_current(pair.candidate.context)
        and authorize_relationship_action(pair.viewer.context)
        and authorize_private_access(VisibilityAudience.DISCOVERABLE,pair.candidate.context)
    )

def require_discovery_candidate(
    pair: DiscoveryMatchingPair,
    *,
    viewer_token: DerivedAuthorityToken,
    viewer_marker: RevocationMarker,
    candidate_token: DerivedAuthorityToken,
    candidate_marker: RevocationMarker,
) -> None:
    require_derived_usable(DerivedSurface.DISCOVERY,viewer_token,viewer_marker)
    require_derived_usable(DerivedSurface.DISCOVERY,candidate_token,candidate_marker)
    if not discovery_candidate_allowed(pair):
        raise DiscoveryMatchingEligibilityDenied("discovery candidate fails current eligibility hard gate")

def match_intent_allowed(pair: DiscoveryMatchingPair) -> bool:
    # PB-2.8 only proves eligibility/lifecycle/safety preconditions for a matching action.
    # Reciprocal consent remains owned by the relationship state machine.
    return (
        _ordinary_current(pair.viewer.context)
        and _ordinary_current(pair.candidate.context)
        and authorize_relationship_action(pair.viewer.context)
        and authorize_relationship_action(pair.candidate.context)
    )

def require_match_intent(
    pair: DiscoveryMatchingPair,
    *,
    viewer_token: DerivedAuthorityToken,
    viewer_marker: RevocationMarker,
    candidate_token: DerivedAuthorityToken,
    candidate_marker: RevocationMarker,
) -> None:
    require_derived_usable(DerivedSurface.MATCHING,viewer_token,viewer_marker)
    require_derived_usable(DerivedSurface.MATCHING,candidate_token,candidate_marker)
    if not match_intent_allowed(pair):
        raise DiscoveryMatchingEligibilityDenied("matching action fails current eligibility hard gate")
