"""PB-6 bounded 420Messenger integration.

PuffBuddies remains authoritative for dating/social relationship authorization.
420Messenger remains authoritative for endpoint, Messenger-native block, conversation,
envelope and receipt coordination.

The profile->Messenger account binding accepted here is transient private integration
input only. PB-6 does not persist, publish or return a profile-to-wallet lookup.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from puffbuddies.domain.messaging_eligibility import (
    MessagingEligibilityPair, MessagingEligibilityDenied, require_ordinary_messaging,
)
from puffbuddies.domain.types import ProfileId, RelationshipState
from puffbuddies.persistence.revocation import DerivedAuthorityToken, RevocationMarker


class MessengerIntegrationDenied(PermissionError):
    pass


class MessengerDependencyUnavailable(RuntimeError):
    pass


class MessengerConversationState(str, Enum):
    NONE = "NONE"
    REQUESTED = "REQUESTED"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


@dataclass(frozen=True)
class MessengerAccountBinding:
    profile_id: ProfileId
    account_ref: str

    def __post_init__(self):
        if not str(self.profile_id):
            raise MessengerIntegrationDenied("profile id required")
        if not self.account_ref or len(self.account_ref) > 128 or any(ch.isspace() for ch in self.account_ref):
            raise MessengerIntegrationDenied("bounded private Messenger account reference required")


@dataclass(frozen=True)
class MessengerConversationSnapshot:
    conversation_ref: str
    a_account_ref: str
    b_account_ref: str
    requested_by_account_ref: str
    state: MessengerConversationState

    def __post_init__(self):
        if not self.conversation_ref or len(self.conversation_ref) > 160:
            raise MessengerIntegrationDenied("bounded conversation reference required")
        if not self.a_account_ref or not self.b_account_ref or self.a_account_ref == self.b_account_ref:
            raise MessengerIntegrationDenied("two Messenger participants required")
        if self.requested_by_account_ref not in {self.a_account_ref, self.b_account_ref}:
            raise MessengerIntegrationDenied("requester must be a participant")


class MessengerAuthorityReader(Protocol):
    def endpoint_active(self, account_ref: str) -> bool: ...
    def blocked(self, account_ref: str, peer_account_ref: str) -> bool: ...
    def conversation(self, conversation_ref: str) -> MessengerConversationSnapshot | None: ...


@dataclass(frozen=True)
class MessengerRequestIntent:
    initiator_account_ref: str
    peer_account_ref: str
    context_ref: str

    def __post_init__(self):
        if self.initiator_account_ref == self.peer_account_ref:
            raise MessengerIntegrationDenied("self conversation prohibited")
        if not self.context_ref or len(self.context_ref) > 160 or any(ch.isspace() for ch in self.context_ref):
            raise MessengerIntegrationDenied("bounded private Messenger context required")


@dataclass(frozen=True)
class MessengerCloseIntent:
    conversation_ref: str
    account_ref: str


@dataclass(frozen=True)
class MessengerAuthorizationConclusion:
    allowed: bool


def _read(call, *args):
    try:
        return call(*args)
    except Exception as exc:
        raise MessengerDependencyUnavailable("420Messenger authority unavailable") from exc


def _bindings_for_pair(
    pair: MessagingEligibilityPair,
    left_binding: MessengerAccountBinding,
    right_binding: MessengerAccountBinding,
) -> None:
    if str(left_binding.profile_id) != pair.left.context.subject_id:
        raise MessengerIntegrationDenied("left profile/account binding mismatch")
    if str(right_binding.profile_id) != pair.right.context.subject_id:
        raise MessengerIntegrationDenied("right profile/account binding mismatch")
    if left_binding.profile_id == right_binding.profile_id:
        raise MessengerIntegrationDenied("distinct profiles required")
    if left_binding.account_ref == right_binding.account_ref:
        raise MessengerIntegrationDenied("distinct Messenger accounts required")


def _require_puffbuddies_current(
    pair: MessagingEligibilityPair,
    *,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
    messenger_native_denied: bool = False,
) -> None:
    try:
        require_ordinary_messaging(
            pair,
            left_token=left_token,
            left_marker=left_marker,
            right_token=right_token,
            right_marker=right_marker,
            messenger_native_denied=messenger_native_denied,
        )
    except (MessagingEligibilityDenied, PermissionError) as exc:
        raise MessengerIntegrationDenied("current PuffBuddies messaging authorization required") from exc


def _native_blocked(
    reader: MessengerAuthorityReader,
    left_account_ref: str,
    right_account_ref: str,
) -> bool:
    return bool(
        _read(reader.blocked, left_account_ref, right_account_ref)
        or _read(reader.blocked, right_account_ref, left_account_ref)
    )


def prepare_conversation_request(
    pair: MessagingEligibilityPair,
    *,
    left_binding: MessengerAccountBinding,
    right_binding: MessengerAccountBinding,
    initiator_profile_id: ProfileId,
    context_ref: str,
    reader: MessengerAuthorityReader,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
) -> MessengerRequestIntent:
    _bindings_for_pair(pair, left_binding, right_binding)
    _require_puffbuddies_current(
        pair,
        left_token=left_token,left_marker=left_marker,
        right_token=right_token,right_marker=right_marker,
    )
    if initiator_profile_id == left_binding.profile_id:
        initiator, peer = left_binding.account_ref, right_binding.account_ref
    elif initiator_profile_id == right_binding.profile_id:
        initiator, peer = right_binding.account_ref, left_binding.account_ref
    else:
        raise MessengerIntegrationDenied("initiator is not a matched participant")

    if not bool(_read(reader.endpoint_active, initiator)):
        raise MessengerIntegrationDenied("initiator Messenger endpoint inactive")
    if not bool(_read(reader.endpoint_active, peer)):
        raise MessengerIntegrationDenied("peer Messenger endpoint inactive")
    if _native_blocked(reader, initiator, peer):
        raise MessengerIntegrationDenied("Messenger-native block denies request")
    return MessengerRequestIntent(initiator, peer, context_ref)


def authorize_conversation_accept(
    pair: MessagingEligibilityPair,
    *,
    left_binding: MessengerAccountBinding,
    right_binding: MessengerAccountBinding,
    accepter_profile_id: ProfileId,
    conversation_ref: str,
    reader: MessengerAuthorityReader,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
) -> MessengerAuthorizationConclusion:
    _bindings_for_pair(pair,left_binding,right_binding)
    _require_puffbuddies_current(
        pair,left_token=left_token,left_marker=left_marker,
        right_token=right_token,right_marker=right_marker,
    )
    snapshot=_read(reader.conversation,conversation_ref)
    if snapshot is None or snapshot.state != MessengerConversationState.REQUESTED:
        raise MessengerIntegrationDenied("Messenger conversation is not request-pending")
    accounts={left_binding.account_ref,right_binding.account_ref}
    if {snapshot.a_account_ref,snapshot.b_account_ref} != accounts:
        raise MessengerIntegrationDenied("Messenger conversation participants mismatch")
    if accepter_profile_id == left_binding.profile_id:
        accepter=left_binding.account_ref
    elif accepter_profile_id == right_binding.profile_id:
        accepter=right_binding.account_ref
    else:
        raise MessengerIntegrationDenied("accepter is not a matched participant")
    if accepter == snapshot.requested_by_account_ref:
        raise MessengerIntegrationDenied("requester cannot self-accept")
    if _native_blocked(reader,left_binding.account_ref,right_binding.account_ref):
        raise MessengerIntegrationDenied("Messenger-native block denies acceptance")
    return MessengerAuthorizationConclusion(True)


def authorize_send(
    pair: MessagingEligibilityPair,
    *,
    left_binding: MessengerAccountBinding,
    right_binding: MessengerAccountBinding,
    sender_profile_id: ProfileId,
    conversation_ref: str,
    reader: MessengerAuthorityReader,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
) -> MessengerAuthorizationConclusion:
    _bindings_for_pair(pair,left_binding,right_binding)
    native_denied=_native_blocked(reader,left_binding.account_ref,right_binding.account_ref)
    _require_puffbuddies_current(
        pair,left_token=left_token,left_marker=left_marker,
        right_token=right_token,right_marker=right_marker,
        messenger_native_denied=native_denied,
    )
    snapshot=_read(reader.conversation,conversation_ref)
    if snapshot is None or snapshot.state != MessengerConversationState.ACTIVE:
        raise MessengerIntegrationDenied("active Messenger conversation required")
    accounts={left_binding.account_ref,right_binding.account_ref}
    if {snapshot.a_account_ref,snapshot.b_account_ref} != accounts:
        raise MessengerIntegrationDenied("Messenger conversation participants mismatch")
    sender = (
        left_binding.account_ref if sender_profile_id == left_binding.profile_id
        else right_binding.account_ref if sender_profile_id == right_binding.profile_id
        else None
    )
    if sender is None or sender not in accounts:
        raise MessengerIntegrationDenied("sender is not a matched participant")
    return MessengerAuthorizationConclusion(True)


def prepare_close_intent_after_puffbuddies_revocation(
    *,
    actor_binding: MessengerAccountBinding,
    peer_binding: MessengerAccountBinding,
    conversation_ref: str,
    reader: MessengerAuthorityReader,
) -> MessengerCloseIntent | None:
    # This is a best-effort coordination handoff only. PuffBuddies revocation already
    # denies its own messaging authorization even if Messenger close has not completed.
    if actor_binding.profile_id == peer_binding.profile_id or actor_binding.account_ref == peer_binding.account_ref:
        raise MessengerIntegrationDenied("distinct participants required")
    snapshot=_read(reader.conversation,conversation_ref)
    if snapshot is None or snapshot.state == MessengerConversationState.CLOSED:
        return None
    if {snapshot.a_account_ref,snapshot.b_account_ref} != {
        actor_binding.account_ref,peer_binding.account_ref
    }:
        raise MessengerIntegrationDenied("Messenger conversation participants mismatch")
    return MessengerCloseIntent(conversation_ref,actor_binding.account_ref)


def assert_no_persistent_profile_account_mapping(values: dict[str, object]) -> None:
    forbidden={"profile_id","wallet_address","account_ref","messenger_account","conversation_ref"}
    if forbidden & set(values):
        raise MessengerIntegrationDenied("profile/Messenger account linkage must not be persisted")
