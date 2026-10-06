"""PB-9 Verification and reputation.

Bounded private verification indicators with user-controlled presentation. "Reputation"
in PB-9 is deliberately non-scored: a user may choose to present current positive
verification indicators, but PuffBuddies does not compute a universal trust,
desirability, social-worth or safety score.

420Verify is intentionally not accepted as interpersonal identity/reputation authority;
PB-0.8 limits it to the evidence domain it actually verifies.
"""
from dataclasses import dataclass, replace
from enum import Enum
from typing import Iterable, Mapping

from puffbuddies.domain.invalidation import CanonicalChange, Invalidation, invalidation_for
from puffbuddies.domain.types import ProfileId, VisibilityAudience
from puffbuddies.persistence.revocation import RevocationMarker, next_revocation


class VerificationDenied(ValueError):
    pass


class VerificationKind(str, Enum):
    ACCOUNT_CONTROL = "ACCOUNT_CONTROL"
    IDENTITY_CREDENTIAL = "IDENTITY_CREDENTIAL"
    NAME_CONTROL = "NAME_CONTROL"
    PHOTO_LIVENESS = "PHOTO_LIVENESS"


class VerificationSource(str, Enum):
    WALLET = "420Wallet"
    IDENTITY = "420Identity"
    NAMES = "420Names"
    PUFFBUDDIES_PRIVATE = "PuffBuddiesPrivateVerification"


class VerificationState(str, Enum):
    VERIFIED = "VERIFIED"
    REVOKED = "REVOKED"
    EXPIRED = "EXPIRED"


_ALLOWED_SOURCE = {
    VerificationKind.ACCOUNT_CONTROL: VerificationSource.WALLET,
    VerificationKind.IDENTITY_CREDENTIAL: VerificationSource.IDENTITY,
    VerificationKind.NAME_CONTROL: VerificationSource.NAMES,
    VerificationKind.PHOTO_LIVENESS: VerificationSource.PUFFBUDDIES_PRIVATE,
}

PRESENTATION_LABELS = {
    VerificationKind.ACCOUNT_CONTROL: "account_control_verified",
    VerificationKind.IDENTITY_CREDENTIAL: "identity_verified",
    VerificationKind.NAME_CONTROL: "name_control_verified",
    VerificationKind.PHOTO_LIVENESS: "photo_liveness_verified",
}

ALLOWED_PRESENTATION_AUDIENCES = frozenset({
    VisibilityAudience.PRIVATE_SELF,
    VisibilityAudience.DISCOVERABLE,
    VisibilityAudience.MATCHED,
})


@dataclass(frozen=True)
class VerificationIndicator:
    profile_id: ProfileId
    kind: VerificationKind
    source: VerificationSource
    source_version: str
    state: VerificationState
    issued_at_epoch: int
    expires_at_epoch: int | None
    user_visible: bool
    version: int = 1

    def __post_init__(self):
        if not str(self.profile_id):
            raise VerificationDenied("profile id required")
        if _ALLOWED_SOURCE[self.kind] != self.source:
            raise VerificationDenied("verification kind/source authority mismatch")
        if not self.source_version or len(self.source_version) > 96 or any(ch.isspace() for ch in self.source_version):
            raise VerificationDenied("bounded source version required")
        if self.issued_at_epoch < 0:
            raise VerificationDenied("issued time required")
        if self.expires_at_epoch is not None and self.expires_at_epoch <= self.issued_at_epoch:
            raise VerificationDenied("expiry must be after issuance")
        if self.version < 1:
            raise VerificationDenied("positive indicator version required")

    @property
    def key(self) -> str:
        return f"{self.profile_id}:{self.kind.value}"


@dataclass(frozen=True)
class VerificationMutation:
    indicator: VerificationIndicator
    marker: RevocationMarker
    invalidation: Invalidation


@dataclass(frozen=True)
class VerificationPresentation:
    indicators: tuple[str, ...]

    def __post_init__(self):
        if tuple(sorted(set(self.indicators))) != self.indicators:
            raise VerificationDenied("presentation indicators must be sorted and unique")


def issue_indicator(
    *,
    profile_id: ProfileId,
    kind: VerificationKind,
    source: VerificationSource,
    source_version: str,
    issued_at_epoch: int,
    expires_at_epoch: int | None,
    current_generation: int,
    user_visible: bool = False,
) -> VerificationMutation:
    indicator = VerificationIndicator(
        profile_id, kind, source, source_version, VerificationState.VERIFIED,
        issued_at_epoch, expires_at_epoch, user_visible, 1,
    )
    marker = next_revocation(str(profile_id), current_generation, "VERIFICATION_CHANGED")
    return VerificationMutation(
        indicator, marker, invalidation_for(marker, CanonicalChange.PROFILE)
    )


def effective_state(indicator: VerificationIndicator, *, now_epoch: int) -> VerificationState:
    if now_epoch < indicator.issued_at_epoch:
        raise VerificationDenied("verification from future is invalid")
    if indicator.state != VerificationState.VERIFIED:
        return indicator.state
    if indicator.expires_at_epoch is not None and now_epoch >= indicator.expires_at_epoch:
        return VerificationState.EXPIRED
    return VerificationState.VERIFIED


def set_indicator_visibility(
    indicator: VerificationIndicator,
    *,
    actor_profile_id: ProfileId,
    user_visible: bool,
    current_generation: int,
) -> VerificationMutation:
    if actor_profile_id != indicator.profile_id:
        raise VerificationDenied("only profile owner may change verification presentation")
    updated = replace(indicator, user_visible=user_visible, version=indicator.version + 1)
    marker = next_revocation(str(indicator.profile_id), current_generation, "VERIFICATION_VISIBILITY_CHANGED")
    return VerificationMutation(
        updated, marker, invalidation_for(marker, CanonicalChange.VISIBILITY)
    )


def revoke_indicator(
    indicator: VerificationIndicator,
    *,
    source: VerificationSource,
    current_generation: int,
) -> VerificationMutation:
    if source != indicator.source:
        raise VerificationDenied("only owning verification source may revoke")
    updated = replace(indicator, state=VerificationState.REVOKED, user_visible=False, version=indicator.version + 1)
    marker = next_revocation(str(indicator.profile_id), current_generation, "VERIFICATION_REVOKED")
    return VerificationMutation(
        updated, marker, invalidation_for(marker, CanonicalChange.PROFILE)
    )


def verification_presentation(
    indicators: Iterable[VerificationIndicator],
    *,
    profile_id: ProfileId,
    audience: VisibilityAudience,
    now_epoch: int,
) -> VerificationPresentation:
    if audience not in ALLOWED_PRESENTATION_AUDIENCES:
        raise VerificationDenied("verification presentation is private in-app only")
    labels = []
    for indicator in indicators:
        if indicator.profile_id != profile_id:
            raise VerificationDenied("cross-profile verification indicator")
        if not indicator.user_visible and audience != VisibilityAudience.PRIVATE_SELF:
            continue
        if effective_state(indicator, now_epoch=now_epoch) != VerificationState.VERIFIED:
            continue
        labels.append(PRESENTATION_LABELS[indicator.kind])
    return VerificationPresentation(tuple(sorted(set(labels))))


def narrow_matching_indicators(
    indicators: Iterable[VerificationIndicator],
    *,
    profile_id: ProfileId,
    now_epoch: int,
) -> frozenset[VerificationKind]:
    """Return current user-visible indicator kinds only.

    This bounded input may be consumed by later ranking policy, but it carries no score,
    weight, ordering, safety conclusion, report/moderation history, wealth or consent.
    """
    out = set()
    for indicator in indicators:
        if indicator.profile_id != profile_id:
            raise VerificationDenied("cross-profile verification indicator")
        if indicator.user_visible and effective_state(indicator, now_epoch=now_epoch) == VerificationState.VERIFIED:
            out.add(indicator.kind)
    return frozenset(out)


def encode_indicator(indicator: VerificationIndicator) -> dict[str, object]:
    return {
        "profile_id": str(indicator.profile_id),
        "kind": indicator.kind.value,
        "source": indicator.source.value,
        "source_version": indicator.source_version,
        "state": indicator.state.value,
        "issued_at_epoch": indicator.issued_at_epoch,
        "expires_at_epoch": indicator.expires_at_epoch,
        "user_visible": indicator.user_visible,
        "version": indicator.version,
    }


def decode_indicator(values: Mapping[str, object], *, profile_id: ProfileId, kind: VerificationKind) -> VerificationIndicator:
    expected = {
        "profile_id", "kind", "source", "source_version", "state",
        "issued_at_epoch", "expires_at_epoch", "user_visible", "version",
    }
    if set(values) != expected or values.get("profile_id") != str(profile_id) or values.get("kind") != kind.value:
        raise VerificationDenied("canonical verification indicator required")
    if not isinstance(values.get("user_visible"), bool):
        raise VerificationDenied("canonical boolean visibility required")
    try:
        return VerificationIndicator(
            profile_id,
            kind,
            VerificationSource(str(values["source"])),
            str(values["source_version"]),
            VerificationState(str(values["state"])),
            int(values["issued_at_epoch"]),
            None if values["expires_at_epoch"] is None else int(values["expires_at_epoch"]),
            values["user_visible"],
            int(values["version"]),
        )
    except (ValueError, TypeError) as exc:
        raise VerificationDenied("invalid verification indicator") from exc


def persist_indicator(repository, indicator: VerificationIndicator, *, expected_version: int | None):
    return repository.put("verification", indicator.key, encode_indicator(indicator), expected_version=expected_version)


def load_indicator(repository, profile_id: ProfileId, kind: VerificationKind):
    key = f"{profile_id}:{kind.value}"
    row = repository.get("verification", key)
    if row is None:
        return None, None
    return decode_indicator(row.values, profile_id=profile_id, kind=kind), row.version


def assert_no_reputation_score(values: Mapping[str, object]) -> None:
    forbidden = {
        "score", "reputation_score", "trust_score", "desirability_score", "social_credit",
        "report_count", "block_count", "moderation_score", "risk_score", "wallet_balance",
        "token_balance", "staking_balance", "payment_volume", "premium_status",
    }
    if forbidden & set(values):
        raise VerificationDenied("scored/public reputation state is prohibited")
