"""PB-1.1 authority/data-boundary declarations.

These constants are deliberately executable so tests can prevent accidental authority drift.
"""
from .types import VisibilityAudience

CANONICAL_OWNER = {
    "membership": "puffbuddies",
    "eligibility_decision": "puffbuddies",
    "profile": "puffbuddies",
    "preferences": "puffbuddies",
    "relationship": "puffbuddies",
    "safety": "puffbuddies",
    "lifecycle": "puffbuddies",
}
EXTERNAL_AUTHORITIES = {
    "wallet_control": "420Wallet",
    "eligibility_evidence": "420Identity",
    "name_state": "420Names",
    "message_transport": "420Messenger",
    "notification_delivery": "420Notifications",
    "payment_settlement": "420Pay",
}
DERIVED_NON_AUTHORITIES = frozenset({"420Indexer","420Search","420Explorer","420Analytics","client","cache","projection"})
DEFAULT_AUDIENCE = {
    "membership": VisibilityAudience.NEVER_PUBLIC,
    "eligibility_evidence": VisibilityAudience.NEVER_PUBLIC,
    "eligibility_decision": VisibilityAudience.SERVICE_MINIMUM,
    "preferences": VisibilityAudience.PRIVATE_SELF,
    "precise_location": VisibilityAudience.NEVER_PUBLIC,
    "relationship": VisibilityAudience.PARTICIPANT_ONLY,
    "safety": VisibilityAudience.MODERATOR_ONLY,
    "lifecycle": VisibilityAudience.PRIVATE_SELF,
    "wallet_profile_link": VisibilityAudience.NEVER_PUBLIC,
}
PUBLICLY_ENUMERABLE = frozenset()
