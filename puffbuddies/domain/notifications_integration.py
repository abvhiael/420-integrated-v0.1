"""PB-7 bounded 420Notifications integration.

PuffBuddies owns whether an application event is currently eligible to produce a
private operational notification intent. 420Notifications owns subscriptions, mute
state, operational/promotional consent, delivery channels/endpoints, queue/retry/
rate-limit/provider state and notification feed/history.

PB-7 never persists a PuffBuddies profile -> notification endpoint mapping.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Mapping, Protocol

from puffbuddies.domain.messaging_eligibility import (
    MessagingEligibilityPair, MessagingEligibilityDenied, require_ordinary_messaging,
)
from puffbuddies.domain.types import ProfileId
from puffbuddies.persistence.revocation import DerivedAuthorityToken, RevocationMarker


NOTIFICATIONS_SERVICE_ID = "420/service/notifications/v1"
PUFFBUDDIES_NOTIFICATION_SOURCE = "puffbuddies"


class NotificationsIntegrationDenied(PermissionError):
    pass


class NotificationsDependencyUnavailable(RuntimeError):
    pass


class NotificationKind(str, Enum):
    MATCHED = "MATCHED"
    MESSAGE_AVAILABLE = "MESSAGE_AVAILABLE"


class NotificationTopic(str, Enum):
    RELATIONSHIPS = "relationships"
    MESSAGES = "messages"


class NotificationSeverity(int, Enum):
    INFO = 1
    WARNING = 2
    CRITICAL = 3


@dataclass(frozen=True)
class PuffBuddiesNotificationIntent:
    event_id: str
    recipient_profile_id: ProfileId
    kind: NotificationKind
    topic: NotificationTopic
    action_ref: str

    def __post_init__(self):
        if not self.event_id or len(self.event_id) > 160 or any(ch.isspace() for ch in self.event_id):
            raise NotificationsIntegrationDenied("bounded opaque event id required")
        if not str(self.recipient_profile_id):
            raise NotificationsIntegrationDenied("recipient profile required")
        if not self.action_ref or len(self.action_ref) > 160 or any(ch.isspace() for ch in self.action_ref):
            raise NotificationsIntegrationDenied("bounded opaque action reference required")
        expected = {
            NotificationKind.MATCHED: NotificationTopic.RELATIONSHIPS,
            NotificationKind.MESSAGE_AVAILABLE: NotificationTopic.MESSAGES,
        }[self.kind]
        if self.topic != expected:
            raise NotificationsIntegrationDenied("notification kind/topic mismatch")


@dataclass(frozen=True)
class NotificationsSubscriptionSnapshot:
    subscription_id: str
    sources: frozenset[str]
    topics: frozenset[str]
    events: frozenset[str]
    minimum_severity: NotificationSeverity
    channels: tuple[str, ...]
    active: bool
    muted: bool
    operational_consent: bool
    promotional_consent: bool

    def __post_init__(self):
        if not self.subscription_id or len(self.subscription_id) > 160:
            raise NotificationsIntegrationDenied("subscription id required")
        if not self.channels:
            raise NotificationsIntegrationDenied("subscription channel required")
        if len(set(self.channels)) != len(self.channels):
            raise NotificationsIntegrationDenied("duplicate notification channel")
        if any(ch not in {"in_app","web","push"} for ch in self.channels):
            raise NotificationsIntegrationDenied("unsupported notification channel")


@dataclass(frozen=True)
class NotificationsSelection:
    subscription: NotificationsSubscriptionSnapshot
    destinations: Mapping[str, str]

    def __post_init__(self):
        if set(self.destinations) - set(self.subscription.channels):
            raise NotificationsIntegrationDenied("destination for unselected channel")
        for channel in self.subscription.channels:
            destination=str(self.destinations.get(channel,"")).strip()
            if not destination or len(destination) > 256:
                raise NotificationsIntegrationDenied("private delivery destination required")


class NotificationsAuthorityReader(Protocol):
    def selected_subscription(self, subscription_id: str) -> NotificationsSelection | None: ...


@dataclass(frozen=True)
class NotificationDeliveryHandoff:
    service_id: str
    subscription_id: str
    provider_id: str
    channel: str
    event_id: str
    destination: str
    severity: int
    classification: str
    authoritative: bool
    payload: Mapping[str, object]


_PROVIDER_BY_CHANNEL={"in_app":"genesis-in-app","web":"genesis-web","push":"genesis-push"}


def _read_selection(reader: NotificationsAuthorityReader, subscription_id: str) -> NotificationsSelection:
    try:
        selection=reader.selected_subscription(subscription_id)
    except Exception as exc:
        raise NotificationsDependencyUnavailable("420Notifications authority unavailable") from exc
    if selection is None:
        raise NotificationsIntegrationDenied("selected 420Notifications subscription required")
    return selection


def _require_current_pair(
    pair: MessagingEligibilityPair,
    *,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
) -> None:
    try:
        require_ordinary_messaging(
            pair,
            left_token=left_token,left_marker=left_marker,
            right_token=right_token,right_marker=right_marker,
        )
    except (MessagingEligibilityDenied,PermissionError) as exc:
        raise NotificationsIntegrationDenied("current matched PuffBuddies authorization required") from exc


def _recipient_is_pair_member(pair: MessagingEligibilityPair, recipient: ProfileId) -> bool:
    return str(recipient) in {pair.left.context.subject_id,pair.right.context.subject_id}


def _matches_subscription(intent: PuffBuddiesNotificationIntent, sub: NotificationsSubscriptionSnapshot) -> bool:
    if not sub.active or sub.muted or not sub.operational_consent:
        return False
    if sub.sources and PUFFBUDDIES_NOTIFICATION_SOURCE not in sub.sources:
        return False
    if sub.topics and intent.topic.value not in sub.topics:
        return False
    if sub.events and intent.kind.value.lower() not in sub.events:
        return False
    return NotificationSeverity.INFO >= sub.minimum_severity


def prepare_notification_handoffs(
    intent: PuffBuddiesNotificationIntent,
    pair: MessagingEligibilityPair,
    *,
    subscription_id: str,
    reader: NotificationsAuthorityReader,
    left_token: DerivedAuthorityToken,
    left_marker: RevocationMarker,
    right_token: DerivedAuthorityToken,
    right_marker: RevocationMarker,
    messenger_handoff_allowed: bool | None = None,
) -> tuple[NotificationDeliveryHandoff, ...]:
    if not _recipient_is_pair_member(pair,intent.recipient_profile_id):
        raise NotificationsIntegrationDenied("recipient is not a pair participant")

    _require_current_pair(
        pair,
        left_token=left_token,left_marker=left_marker,
        right_token=right_token,right_marker=right_marker,
    )

    # Message-availability notifications are downstream of the qualified PB-6
    # Messenger handoff. PB-7 never infers a message from conversation existence.
    if intent.kind == NotificationKind.MESSAGE_AVAILABLE and messenger_handoff_allowed is not True:
        raise NotificationsIntegrationDenied("current Messenger handoff authorization required")

    selection=_read_selection(reader,subscription_id)
    sub=selection.subscription
    if sub.subscription_id != subscription_id:
        raise NotificationsIntegrationDenied("subscription identity mismatch")
    if not _matches_subscription(intent,sub):
        return ()

    payload={
        "notificationId":intent.event_id,
        "appId":"puffbuddies",
        "kind":intent.kind.value,
        "topic":intent.topic.value,
        "actionRef":intent.action_ref,
        "authoritative":False,
    }

    # Deliberately omit profile IDs, relationship state, account/wallet identifiers,
    # message/conversation identifiers, denial reasons and notification preference state.
    return tuple(
        NotificationDeliveryHandoff(
            service_id=NOTIFICATIONS_SERVICE_ID,
            subscription_id=sub.subscription_id,
            provider_id=_PROVIDER_BY_CHANNEL[channel],
            channel=channel,
            event_id=intent.event_id,
            destination=str(selection.destinations[channel]),
            severity=int(NotificationSeverity.INFO),
            classification="operational",
            authoritative=False,
            payload=dict(payload),
        )
        for channel in sub.channels
    )


def assert_no_persistent_notification_binding(values: Mapping[str, object]) -> None:
    forbidden={
        "profile_id","wallet_address","account_ref","recipient_profile_id",
        "subscription_id","destination","push_token","web_endpoint","device_id",
    }
    if forbidden & set(values):
        raise NotificationsIntegrationDenied("private notification linkage must remain Notifications-owned")
