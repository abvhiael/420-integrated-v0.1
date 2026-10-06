"""PB-4 Discovery engine.

A private, policy-bounded discovery engine. Hard exclusions execute before ranking.
Ranking is derived/non-canonical and cannot create likes, matches, messaging consent,
public profiles, or authority.

The engine consumes current PB-2 eligibility/generation authority and PB-3 profile /
visibility state. It intentionally accepts only coarse proximity bands, never precise
coordinates or raw location history.
"""
from dataclasses import dataclass
from enum import IntEnum
from typing import Iterable, Mapping

from puffbuddies.domain.authorization import AuthorizationContext
from puffbuddies.domain.discovery_matching_eligibility import (
    DiscoveryMatchingPair, DiscoveryMatchingEligibilityDenied, require_discovery_candidate,
)
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.profiles import (
    ProfileRecord, ProfileVisibility, profile_complete, visible_profile_fields,
)
from puffbuddies.domain.types import CannabisUse, IntentMode, ProfileId
from puffbuddies.persistence.revocation import DerivedAuthorityToken, RevocationMarker


class DiscoveryDenied(PermissionError):
    pass


class CoarseDistanceBand(IntEnum):
    SAME_AREA = 0
    NEARBY = 1
    REGIONAL = 2
    DISTANT = 3
    UNKNOWN = 99


@dataclass(frozen=True)
class DiscoveryPreferencesRecord:
    profile_id: ProfileId
    modes: frozenset[IntentMode]
    max_distance_band: CoarseDistanceBand
    allowed_cannabis: frozenset[CannabisUse] | None
    version: int

    def __post_init__(self):
        if not str(self.profile_id):
            raise DiscoveryDenied("profile id required")
        if not self.modes:
            raise DiscoveryDenied("at least one discovery mode required")
        if self.max_distance_band == CoarseDistanceBand.UNKNOWN:
            raise DiscoveryDenied("unknown distance band cannot authorize discovery")
        if self.version < 1:
            raise DiscoveryDenied("positive preference version required")
        if self.allowed_cannabis is not None and not self.allowed_cannabis:
            raise DiscoveryDenied("empty cannabis allow-set would be ambiguous")


@dataclass(frozen=True)
class DiscoverySubject:
    authorization: BoundEligibilityAuthorization
    profile: ProfileRecord
    preferences: DiscoveryPreferencesRecord
    cannabis_use: CannabisUse
    token: DerivedAuthorityToken
    marker: RevocationMarker

    def __post_init__(self):
        sid = str(self.profile.profile_id)
        if self.authorization.context.subject_id != sid:
            raise DiscoveryDenied("authorization/profile mismatch")
        if self.preferences.profile_id != self.profile.profile_id:
            raise DiscoveryDenied("preferences/profile mismatch")
        if self.token.subject_id != sid or self.marker.subject_id != sid:
            raise DiscoveryDenied("generation/profile mismatch")


@dataclass(frozen=True)
class DiscoveryCandidate:
    subject: DiscoverySubject
    visibility: tuple[ProfileVisibility, ...]
    distance_band_from_viewer: CoarseDistanceBand
    activity_bucket: int = 0

    def __post_init__(self):
        if self.distance_band_from_viewer == CoarseDistanceBand.UNKNOWN:
            raise DiscoveryDenied("unknown proximity fails closed")
        if not 0 <= self.activity_bucket <= 3:
            raise DiscoveryDenied("activity bucket must be bounded 0..3")
        for policy in self.visibility:
            if policy.profile_id != self.subject.profile.profile_id:
                raise DiscoveryDenied("foreign visibility policy in candidate")


@dataclass(frozen=True)
class DiscoveryResult:
    profile_id: ProfileId
    presentation: Mapping[str, object]


def _mode_accepts(preferences: DiscoveryPreferencesRecord, candidate_mode: IntentMode) -> bool:
    if candidate_mode == IntentMode.BOTH:
        return bool(preferences.modes)
    return candidate_mode in preferences.modes or IntentMode.BOTH in preferences.modes


def _mode_pair_compatible(viewer: DiscoverySubject, candidate: DiscoverySubject) -> bool:
    return (
        _mode_accepts(viewer.preferences, candidate.profile.mode)
        and _mode_accepts(candidate.preferences, viewer.profile.mode)
    )


def _cannabis_compatible(preferences: DiscoveryPreferencesRecord, use: CannabisUse) -> bool:
    return preferences.allowed_cannabis is None or use in preferences.allowed_cannabis


def _hard_compatible(viewer: DiscoverySubject, candidate: DiscoveryCandidate) -> bool:
    c = candidate.subject
    if viewer.profile.profile_id == c.profile.profile_id:
        return False
    if not profile_complete(viewer.profile) or not profile_complete(c.profile):
        return False
    if not _mode_pair_compatible(viewer, c):
        return False
    if candidate.distance_band_from_viewer > viewer.preferences.max_distance_band:
        return False
    if not _cannabis_compatible(viewer.preferences, c.cannabis_use):
        return False
    if not _cannabis_compatible(c.preferences, viewer.cannabis_use):
        return False
    return True


def _rank_key(viewer: DiscoverySubject, candidate: DiscoveryCandidate) -> tuple[int, int, str]:
    # Ranking is deliberately simple, reproducible and based only on explicit allowed
    # inputs. Lower tuple sorts first. No wealth/payment, moderation counts, wallet
    # state, identity evidence, precise location or hidden sensitive inference.
    mutual_mode_exact = int(
        candidate.subject.profile.mode != viewer.profile.mode
        and IntentMode.BOTH not in {candidate.subject.profile.mode, viewer.profile.mode}
    )
    return (
        int(candidate.distance_band_from_viewer),
        -candidate.activity_bucket,
        str(candidate.subject.profile.profile_id),
    )


def _candidate_presentation(
    viewer: DiscoverySubject,
    candidate: DiscoveryCandidate,
) -> Mapping[str, object]:
    c = candidate.subject
    # The candidate authorization context already represents the viewer->candidate
    # relationship and PB-2 current eligibility/lifecycle/block gate.
    fields = visible_profile_fields(c.profile, candidate.visibility, c.authorization.context)
    # Distance is deliberately not returned: repeated distance observations can become
    # a location-triangulation side channel. Coarse distance remains ranking input only.
    return dict(fields)


def discover(
    viewer: DiscoverySubject,
    candidates: Iterable[DiscoveryCandidate],
    *,
    ranking_available: bool = True,
    limit: int = 50,
) -> tuple[DiscoveryResult, ...]:
    if limit < 1 or limit > 100:
        raise DiscoveryDenied("bounded result limit required")
    if not profile_complete(viewer.profile):
        raise DiscoveryDenied("viewer profile incomplete")

    accepted: list[DiscoveryCandidate] = []
    for candidate in candidates:
        c = candidate.subject
        try:
            require_discovery_candidate(
                DiscoveryMatchingPair(viewer.authorization, c.authorization),
                viewer_token=viewer.token,
                viewer_marker=viewer.marker,
                candidate_token=c.token,
                candidate_marker=c.marker,
            )
        except (DiscoveryMatchingEligibilityDenied, PermissionError):
            continue

        if not _hard_compatible(viewer, candidate):
            continue

        presentation = _candidate_presentation(viewer, candidate)
        # A candidate with no currently authorized discoverable presentation is not a
        # useful/allowed discovery result.
        if not presentation:
            continue
        accepted.append(candidate)

    if ranking_available:
        accepted.sort(key=lambda c: _rank_key(viewer, c))
    else:
        # Safe degradation: deterministic order only after all hard exclusions.
        accepted.sort(key=lambda c: str(c.subject.profile.profile_id))

    return tuple(
        DiscoveryResult(c.subject.profile.profile_id, _candidate_presentation(viewer, c))
        for c in accepted[:limit]
    )


def encode_discovery_preferences(p: DiscoveryPreferencesRecord) -> dict[str, object]:
    return {
        "profile_id": str(p.profile_id),
        "discovery_modes": sorted(mode.value for mode in p.modes),
        "distance_band": int(p.max_distance_band),
        "compatibility": None if p.allowed_cannabis is None else sorted(x.value for x in p.allowed_cannabis),
        "visibility_version": p.version,
    }


def decode_discovery_preferences(values: Mapping[str, object], *, profile_id: ProfileId) -> DiscoveryPreferencesRecord:
    expected = {"profile_id", "discovery_modes", "distance_band", "compatibility", "visibility_version"}
    if set(values) != expected or values.get("profile_id") != str(profile_id):
        raise DiscoveryDenied("canonical discovery preferences required")
    raw_modes = values.get("discovery_modes")
    raw_cannabis = values.get("compatibility")
    if not isinstance(raw_modes, (list, tuple)):
        raise DiscoveryDenied("invalid discovery modes")
    if raw_cannabis is not None and not isinstance(raw_cannabis, (list, tuple)):
        raise DiscoveryDenied("invalid cannabis compatibility")
    try:
        return DiscoveryPreferencesRecord(
            profile_id=profile_id,
            modes=frozenset(IntentMode(str(x)) for x in raw_modes),
            max_distance_band=CoarseDistanceBand(int(values["distance_band"])),
            allowed_cannabis=None if raw_cannabis is None else frozenset(CannabisUse(str(x)) for x in raw_cannabis),
            version=int(values["visibility_version"]),
        )
    except (ValueError, TypeError) as exc:
        raise DiscoveryDenied("invalid discovery preference record") from exc


def persist_discovery_preferences(repository, p: DiscoveryPreferencesRecord, *, expected_version: int | None):
    return repository.put(
        "preferences",
        str(p.profile_id),
        encode_discovery_preferences(p),
        expected_version=expected_version,
    )


def load_discovery_preferences(repository, profile_id: ProfileId):
    row = repository.get("preferences", str(profile_id))
    if row is None:
        return None, None
    return decode_discovery_preferences(row.values, profile_id=profile_id), row.version
