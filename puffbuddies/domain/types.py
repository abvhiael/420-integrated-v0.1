"""Canonical PuffBuddies PB-1 domain types and authority boundaries.

No public-chain, transport, persistence, or dependency adapter is authoritative here.
"""
from dataclasses import dataclass
from enum import Enum
from typing import NewType, FrozenSet

ProfileId = NewType("ProfileId", str)

class IntentMode(str, Enum):
    DATING = "DATING"
    BUDDY = "BUDDY"
    BOTH = "BOTH"

class VisibilityAudience(str, Enum):
    PRIVATE_SELF = "PRIVATE_SELF"
    DISCOVERABLE = "DISCOVERABLE"
    MATCHED = "MATCHED"
    PARTICIPANT_ONLY = "PARTICIPANT_ONLY"
    MODERATOR_ONLY = "MODERATOR_ONLY"
    SERVICE_MINIMUM = "SERVICE_MINIMUM"
    AGGREGATE_ONLY = "AGGREGATE_ONLY"
    PUBLIC_EXPLICIT = "PUBLIC_EXPLICIT"
    NEVER_PUBLIC = "NEVER_PUBLIC"

class LifecycleState(str, Enum):
    UNREGISTERED = "UNREGISTERED"
    ELIGIBILITY_PENDING = "ELIGIBILITY_PENDING"
    ELIGIBILITY_FAILED = "ELIGIBILITY_FAILED"
    PROFILE_INCOMPLETE = "PROFILE_INCOMPLETE"
    ACTIVE = "ACTIVE"
    DEACTIVATED = "DEACTIVATED"
    RESTRICTED = "RESTRICTED"
    SUSPENDED = "SUSPENDED"
    BANNED = "BANNED"
    DELETE_REQUESTED = "DELETE_REQUESTED"
    DELETION_IN_PROGRESS = "DELETION_IN_PROGRESS"
    DELETION_COMPLETE = "DELETION_COMPLETE"
    RETAINED_EVIDENCE_ONLY = "RETAINED_EVIDENCE_ONLY"
    APPEAL_REVIEW = "APPEAL_REVIEW"

class RelationshipState(str, Enum):
    NONE = "NONE"
    LIKED = "LIKED"
    PASSED = "PASSED"
    MATCHED = "MATCHED"
    UNMATCHED = "UNMATCHED"
    BLOCKED = "BLOCKED"

class EligibilityState(str, Enum):
    UNKNOWN = "UNKNOWN"
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"

class CannabisUse(str, Enum):
    NONE = "NONE"
    OCCASIONAL = "OCCASIONAL"
    REGULAR = "REGULAR"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"

@dataclass(frozen=True)
class EligibilityProjection:
    state: EligibilityState
    source_version: str
    expires_at_epoch: int | None = None

@dataclass(frozen=True)
class Profile:
    profile_id: ProfileId
    mode: IntentMode
    lifecycle: LifecycleState

@dataclass(frozen=True)
class DiscoveryPreferences:
    modes: FrozenSet[IntentMode]
    cannabis_compatible: bool | None

@dataclass(frozen=True)
class CannabisProfile:
    use: CannabisUse
    discoverable: bool = False

@dataclass(frozen=True)
class Relationship:
    left: ProfileId
    right: ProfileId
    state: RelationshipState

@dataclass(frozen=True)
class SafetyState:
    blocked_profile_ids: FrozenSet[ProfileId]
    restricted: bool = False

@dataclass(frozen=True)
class MatchingInput:
    profile_id: ProfileId
    eligibility: EligibilityProjection
    lifecycle: LifecycleState
    preferences: DiscoveryPreferences
    safety: SafetyState

CANONICAL_PRIVATE_TYPES = frozenset({
    "EligibilityProjection", "Profile", "DiscoveryPreferences", "CannabisProfile",
    "Relationship", "SafetyState", "MatchingInput",
})
