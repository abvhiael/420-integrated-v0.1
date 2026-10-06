"""PB-3 Profiles.

Canonical private PuffBuddies profile creation/editing, completeness, field visibility,
lifecycle wrappers, persistence, and derived-state invalidation.

This module deliberately does not implement media upload/storage, discovery/ranking,
matching, public profiles, clients, APIs, contracts, deployments, or production storage.
"""
from dataclasses import dataclass, replace
from typing import Mapping, Iterable

from puffbuddies.domain.authorization import (
    AuthorizationContext, authorize_private_access, PrincipalKind,
)
from puffbuddies.domain.invalidation import (
    CanonicalChange, Invalidation, invalidation_for,
)
from puffbuddies.domain.state_machines import (
    Authority, lifecycle_transition, TransitionDenied,
)
from puffbuddies.domain.types import (
    EligibilityState, IntentMode, LifecycleState, ProfileId, VisibilityAudience,
)
from puffbuddies.persistence.revocation import RevocationMarker, next_revocation

class ProfileDenied(ValueError):
    pass

PROFILE_TEXT_LIMITS = {
    "display_name": 80,
    "bio": 500,
    "prompt_1": 300,
    "prompt_2": 300,
    "prompt_3": 300,
    "pronouns": 80,
    "relationship_intent": 160,
}
PROFILE_FIELDS = frozenset(PROFILE_TEXT_LIMITS)
PROFILE_PRESENTATION_KEYS = frozenset(set(PROFILE_FIELDS) | {"mode", "media_refs"})

# PB-3 has no public-profile product surface. Profile fields may be self-only,
# in-app discoverable, or narrowed to a current match.
PROFILE_ALLOWED_AUDIENCES = frozenset({
    VisibilityAudience.PRIVATE_SELF,
    VisibilityAudience.DISCOVERABLE,
    VisibilityAudience.MATCHED,
})

EDITABLE_LIFECYCLES = frozenset({
    LifecycleState.PROFILE_INCOMPLETE,
    LifecycleState.ACTIVE,
    LifecycleState.DEACTIVATED,
})

@dataclass(frozen=True)
class ProfileRecord:
    profile_id: ProfileId
    mode: IntentMode
    lifecycle: LifecycleState
    display_fields: tuple[tuple[str, str], ...]
    media_refs: tuple[str, ...]
    visibility_version: int = 1

    def __post_init__(self):
        if not str(self.profile_id):
            raise ProfileDenied("profile id required")
        if self.visibility_version < 1:
            raise ProfileDenied("positive visibility version required")
        if self.lifecycle in {
            LifecycleState.UNREGISTERED,
            LifecycleState.ELIGIBILITY_PENDING,
            LifecycleState.ELIGIBILITY_FAILED,
            LifecycleState.DELETION_COMPLETE,
            LifecycleState.RETAINED_EVIDENCE_ONLY,
        }:
            raise ProfileDenied("lifecycle cannot own an ordinary profile record")
        fields = dict(self.display_fields)
        if len(fields) != len(self.display_fields):
            raise ProfileDenied("duplicate profile field")
        if set(fields) - PROFILE_FIELDS:
            raise ProfileDenied("noncanonical profile field")
        if tuple(sorted(fields.items())) != self.display_fields:
            raise ProfileDenied("profile fields must be canonical sorted tuples")
        for key, value in fields.items():
            if not isinstance(value, str):
                raise ProfileDenied("profile text must be text")
            if len(value) > PROFILE_TEXT_LIMITS[key]:
                raise ProfileDenied("profile field exceeds bound")
            if any(ch in value for ch in ("\x00",)):
                raise ProfileDenied("invalid profile text")
        if len(self.media_refs) > 6:
            raise ProfileDenied("at most six profile media references")
        if len(set(self.media_refs)) != len(self.media_refs):
            raise ProfileDenied("duplicate profile media reference")
        for ref in self.media_refs:
            if not ref or len(ref) > 128 or "://" in ref or any(ch.isspace() for ch in ref):
                raise ProfileDenied("media reference must be bounded opaque metadata")

    @property
    def fields(self) -> dict[str, str]:
        return dict(self.display_fields)

@dataclass(frozen=True)
class ProfileVisibility:
    profile_id: ProfileId
    field_key: str
    audience: VisibilityAudience
    version: int

    def __post_init__(self):
        if not str(self.profile_id) or self.field_key not in PROFILE_PRESENTATION_KEYS:
            raise ProfileDenied("canonical profile visibility key required")
        if self.audience not in PROFILE_ALLOWED_AUDIENCES:
            raise ProfileDenied("profile field audience not allowed in PB-3")
        if self.version < 1:
            raise ProfileDenied("positive visibility version required")

@dataclass(frozen=True)
class ProfileMutationOutcome:
    profile: ProfileRecord
    marker: RevocationMarker
    invalidation: Invalidation

def _canonical_fields(fields: Mapping[str, str]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((str(k), v) for k, v in fields.items()))

def create_profile(
    profile_id: ProfileId,
    *,
    mode: IntentMode,
    eligibility: EligibilityState,
    lifecycle: LifecycleState,
) -> ProfileRecord:
    if eligibility != EligibilityState.ELIGIBLE:
        raise ProfileDenied("current eligibility required")
    if lifecycle != LifecycleState.PROFILE_INCOMPLETE:
        raise ProfileDenied("profile creation requires PROFILE_INCOMPLETE lifecycle")
    return ProfileRecord(profile_id, mode, lifecycle, tuple(), tuple(), 1)

def profile_complete(profile: ProfileRecord) -> bool:
    fields = profile.fields
    return bool(fields.get("display_name", "").strip()) and len(profile.media_refs) >= 1

def edit_profile(
    profile: ProfileRecord,
    *,
    actor_profile_id: ProfileId,
    display_fields: Mapping[str, str] | None = None,
    media_refs: Iterable[str] | None = None,
    mode: IntentMode | None = None,
    current_generation: int,
) -> ProfileMutationOutcome:
    if actor_profile_id != profile.profile_id:
        raise ProfileDenied("only profile owner may edit")
    if profile.lifecycle not in EDITABLE_LIFECYCLES:
        raise ProfileDenied("profile lifecycle does not permit editing")
    new_fields = profile.fields if display_fields is None else dict(display_fields)
    new_media = profile.media_refs if media_refs is None else tuple(media_refs)
    updated = ProfileRecord(
        profile.profile_id,
        profile.mode if mode is None else mode,
        profile.lifecycle,
        _canonical_fields(new_fields),
        tuple(new_media),
        profile.visibility_version,
    )
    marker = next_revocation(str(profile.profile_id), current_generation, "PROFILE_CHANGED")
    return ProfileMutationOutcome(updated, marker, invalidation_for(marker, CanonicalChange.PROFILE))

def default_profile_visibility(profile: ProfileRecord) -> tuple[ProfileVisibility, ...]:
    policies = []
    keys = set(profile.fields)
    keys.update({"mode", "media_refs"})
    for key in sorted(keys):
        audience = VisibilityAudience.DISCOVERABLE
        if key in {"pronouns", "relationship_intent"}:
            audience = VisibilityAudience.PRIVATE_SELF
        policies.append(ProfileVisibility(profile.profile_id, key, audience, profile.visibility_version))
    return tuple(policies)

def change_profile_visibility(
    profile: ProfileRecord,
    *,
    actor_profile_id: ProfileId,
    field_key: str,
    audience: VisibilityAudience,
    current_generation: int,
) -> tuple[ProfileRecord, ProfileVisibility, RevocationMarker, Invalidation]:
    if actor_profile_id != profile.profile_id:
        raise ProfileDenied("only profile owner may change visibility")
    if profile.lifecycle not in EDITABLE_LIFECYCLES:
        raise ProfileDenied("profile lifecycle does not permit visibility change")
    next_version = profile.visibility_version + 1
    policy = ProfileVisibility(profile.profile_id, field_key, audience, next_version)
    updated = replace(profile, visibility_version=next_version)
    marker = next_revocation(str(profile.profile_id), current_generation, "VISIBILITY_CHANGED")
    return updated, policy, marker, invalidation_for(marker, CanonicalChange.VISIBILITY)

def visible_profile_fields(
    profile: ProfileRecord,
    policies: Iterable[ProfileVisibility],
    context: AuthorizationContext,
) -> dict[str, object]:
    if context.subject_id != str(profile.profile_id):
        raise ProfileDenied("authorization subject/profile mismatch")
    if context.lifecycle != profile.lifecycle:
        raise ProfileDenied("stale lifecycle authorization context")
    by_key = {p.field_key: p for p in policies if p.profile_id == profile.profile_id}
    out: dict[str, object] = {}
    values: dict[str, object] = dict(profile.fields)
    values["mode"] = profile.mode.value
    values["media_refs"] = profile.media_refs
    for key, value in values.items():
        policy = by_key.get(key)
        if policy is None or policy.version != profile.visibility_version:
            continue
        if authorize_private_access(policy.audience, context):
            out[key] = value
    return out

def activate_or_reactivate_profile(
    profile: ProfileRecord,
    *,
    eligibility: EligibilityState,
    current_generation: int,
) -> ProfileMutationOutcome:
    if eligibility != EligibilityState.ELIGIBLE:
        raise ProfileDenied("current eligibility required")
    if not profile_complete(profile):
        raise ProfileDenied("profile incomplete")
    try:
        lifecycle = lifecycle_transition(profile.lifecycle, LifecycleState.ACTIVE, Authority.PROFILE_POLICY)
    except TransitionDenied as exc:
        raise ProfileDenied(str(exc)) from exc
    updated = replace(profile, lifecycle=lifecycle)
    marker = next_revocation(str(profile.profile_id), current_generation, "LIFECYCLE_CHANGED")
    return ProfileMutationOutcome(updated, marker, invalidation_for(marker, CanonicalChange.LIFECYCLE))

def deactivate_profile(
    profile: ProfileRecord,
    *,
    actor_profile_id: ProfileId,
    current_generation: int,
) -> ProfileMutationOutcome:
    if actor_profile_id != profile.profile_id:
        raise ProfileDenied("only profile owner may deactivate")
    try:
        lifecycle = lifecycle_transition(profile.lifecycle, LifecycleState.DEACTIVATED, Authority.USER)
    except TransitionDenied as exc:
        raise ProfileDenied(str(exc)) from exc
    updated = replace(profile, lifecycle=lifecycle)
    marker = next_revocation(str(profile.profile_id), current_generation, "LIFECYCLE_CHANGED")
    return ProfileMutationOutcome(updated, marker, invalidation_for(marker, CanonicalChange.LIFECYCLE))

def request_profile_deletion(
    profile: ProfileRecord,
    *,
    actor_profile_id: ProfileId,
    current_generation: int,
) -> ProfileMutationOutcome:
    if actor_profile_id != profile.profile_id:
        raise ProfileDenied("only profile owner may request deletion")
    try:
        lifecycle = lifecycle_transition(profile.lifecycle, LifecycleState.DELETE_REQUESTED, Authority.USER)
    except TransitionDenied as exc:
        raise ProfileDenied(str(exc)) from exc
    updated = replace(profile, lifecycle=lifecycle)
    marker = next_revocation(str(profile.profile_id), current_generation, "DELETE_REQUESTED")
    return ProfileMutationOutcome(updated, marker, invalidation_for(marker, CanonicalChange.DELETE))

def encode_profile(profile: ProfileRecord) -> dict[str, object]:
    return {
        "profile_id": str(profile.profile_id),
        "mode": profile.mode.value,
        "lifecycle": profile.lifecycle.value,
        "display_fields": dict(profile.display_fields),
        "media_refs": list(profile.media_refs),
        "visibility_version": profile.visibility_version,
    }

def decode_profile(values: Mapping[str, object], *, profile_id: ProfileId) -> ProfileRecord:
    expected = {"profile_id", "mode", "lifecycle", "display_fields", "media_refs", "visibility_version"}
    if set(values) != expected or values.get("profile_id") != str(profile_id):
        raise ProfileDenied("canonical profile record required")
    fields = values.get("display_fields")
    media = values.get("media_refs")
    if not isinstance(fields, Mapping) or not isinstance(media, (list, tuple)):
        raise ProfileDenied("invalid profile record shape")
    try:
        return ProfileRecord(
            profile_id,
            IntentMode(str(values["mode"])),
            LifecycleState(str(values["lifecycle"])),
            _canonical_fields({str(k): str(v) for k, v in fields.items()}),
            tuple(str(x) for x in media),
            int(values["visibility_version"]),
        )
    except (ValueError, TypeError) as exc:
        raise ProfileDenied("invalid profile record") from exc

def persist_profile(repository, profile: ProfileRecord, *, expected_version: int | None):
    return repository.put("profile", str(profile.profile_id), encode_profile(profile), expected_version=expected_version)

def load_profile(repository, profile_id: ProfileId):
    row = repository.get("profile", str(profile_id))
    if row is None:
        return None, None
    return decode_profile(row.values, profile_id=profile_id), row.version

def encode_visibility(policy: ProfileVisibility) -> dict[str, object]:
    return {
        "profile_id": str(policy.profile_id),
        "field_key": policy.field_key,
        "audience": policy.audience.value,
        "version": policy.version,
    }

def persist_visibility(repository, policy: ProfileVisibility, *, expected_version: int | None):
    key = f"{policy.profile_id}:{policy.field_key}"
    return repository.put("visibility", key, encode_visibility(policy), expected_version=expected_version)
