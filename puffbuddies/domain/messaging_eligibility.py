"""PB-2.9 messaging eligibility enforcement.

Defines the PuffBuddies-side current eligibility/consent gate for ordinary matched-user
messaging. It does not implement 420Messenger transport, conversations, envelopes,
delivery, notifications, or live integration.
"""
from dataclasses import dataclass

from puffbuddies.domain.authorization import authorize_private_access
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.invalidation import DerivedSurface, require_derived_usable
from puffbuddies.domain.types import EligibilityState, LifecycleState, RelationshipState, VisibilityAudience
from puffbuddies.persistence.revocation import DerivedAuthorityToken, RevocationMarker

class MessagingEligibilityDenied(PermissionError):
    pass

@dataclass(frozen=True)
class MessagingEligibilityPair:
    left: BoundEligibilityAuthorization
    right: BoundEligibilityAuthorization

def _current_matched_participant(bound: BoundEligibilityAuthorization) -> bool:
    c=bound.context
    return (
        c.eligibility == EligibilityState.ELIGIBLE
        and c.lifecycle == LifecycleState.ACTIVE
        and c.relationship == RelationshipState.MATCHED
        and not c.blocked
        and authorize_private_access(VisibilityAudience.MATCHED,c)
    )

def ordinary_messaging_allowed(
    pair: MessagingEligibilityPair,
    *,
    messenger_native_denied: bool=False,
) -> bool:
    # PuffBuddies owns dating/social authorization. Messenger-native deny state may
    # further deny but can never create or broaden PuffBuddies messaging authority.
    if messenger_native_denied:
        return False
    return _current_matched_participant(pair.left) and _current_matched_participant(pair.right)

def require_ordinary_messaging(
    pair: MessagingEligibilityPair,
    *,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
    messenger_native_denied: bool=False,
) -> None:
    require_derived_usable(DerivedSurface.MESSAGING_AUTH,left_token,left_marker)
    require_derived_usable(DerivedSurface.MESSAGING_AUTH,right_token,right_marker)
    if not ordinary_messaging_allowed(pair,messenger_native_denied=messenger_native_denied):
        raise MessagingEligibilityDenied("ordinary messaging lacks current PuffBuddies authorization")
