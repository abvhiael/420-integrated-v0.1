"""PB-5 Likes and matching.

Private directional LIKE/PASS intent plus reciprocal match formation. Independent user
intent is canonical; discovery/ranking, payments, admins, moderators, automation and
clients cannot fabricate consent.

Directional intents and pair relationships reuse the existing private relationship
table. Intent records are directional. Pair records are canonical sorted pairs carrying
a consent epoch. Unmatch advances the epoch so stale likes cannot rematch the pair.
"""
from dataclasses import dataclass, replace

from puffbuddies.domain.authorization import (
    AuthorizationContext, authorize_relationship_action,
)
from puffbuddies.domain.discovery import DiscoveryCandidate, DiscoverySubject, discover
from puffbuddies.domain.discovery_matching_eligibility import (
    DiscoveryMatchingPair, require_match_intent,
)
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.invalidation import (
    CanonicalChange, Invalidation, invalidation_for,
    DerivedSurface, require_derived_usable,
)
from puffbuddies.domain.state_machines import (
    Authority, TransitionDenied, relationship_transition,
)
from puffbuddies.domain.types import ProfileId, RelationshipState
from puffbuddies.persistence.revocation import (
    DerivedAuthorityToken, RevocationMarker, next_revocation,
)


class MatchingDenied(PermissionError):
    pass


@dataclass(frozen=True)
class DirectedIntent:
    actor_profile_id: ProfileId
    target_profile_id: ProfileId
    state: RelationshipState
    consent_epoch: int

    def __post_init__(self):
        if self.actor_profile_id == self.target_profile_id:
            raise MatchingDenied("self intent prohibited")
        if self.state not in {RelationshipState.LIKED, RelationshipState.PASSED}:
            raise MatchingDenied("directional intent must be LIKE or PASS")
        if self.consent_epoch < 1:
            raise MatchingDenied("positive consent epoch required")

    @property
    def relationship_id(self) -> str:
        return f"intent:{self.actor_profile_id}>{self.target_profile_id}"


@dataclass(frozen=True)
class PairRelationship:
    left_profile_id: ProfileId
    right_profile_id: ProfileId
    state: RelationshipState
    consent_epoch: int

    def __post_init__(self):
        if not str(self.left_profile_id) or not str(self.right_profile_id):
            raise MatchingDenied("pair profiles required")
        if self.left_profile_id == self.right_profile_id:
            raise MatchingDenied("self pair prohibited")
        if str(self.left_profile_id) > str(self.right_profile_id):
            raise MatchingDenied("pair ids must be canonical sorted")
        if self.state not in {
            RelationshipState.NONE,
            RelationshipState.MATCHED,
            RelationshipState.UNMATCHED,
            RelationshipState.BLOCKED,
        }:
            raise MatchingDenied("pair state is not canonical for PB-5")
        if self.consent_epoch < 1:
            raise MatchingDenied("positive consent epoch required")

    @property
    def relationship_id(self) -> str:
        return f"pair:{self.left_profile_id}|{self.right_profile_id}"


@dataclass(frozen=True)
class MatchingContext:
    left: DiscoverySubject
    right: DiscoverySubject
    right_as_seen_by_left: DiscoveryCandidate
    left_as_seen_by_right: DiscoveryCandidate

    def __post_init__(self):
        if self.left.profile.profile_id == self.right.profile.profile_id:
            raise MatchingDenied("self matching prohibited")
        if self.right_as_seen_by_left.subject.profile.profile_id != self.right.profile.profile_id:
            raise MatchingDenied("left discovery candidate does not represent right profile")
        if self.left_as_seen_by_right.subject.profile.profile_id != self.left.profile.profile_id:
            raise MatchingDenied("right discovery candidate does not represent left profile")


@dataclass(frozen=True)
class RelationshipMutation:
    pair: PairRelationship
    markers: tuple[RevocationMarker, ...]
    invalidations: tuple[Invalidation, ...]


def canonical_pair(left: ProfileId, right: ProfileId, *, state=RelationshipState.NONE, consent_epoch=1) -> PairRelationship:
    a,b=sorted((str(left),str(right)))
    return PairRelationship(ProfileId(a),ProfileId(b),state,consent_epoch)


def _subject_for(ctx: MatchingContext, profile_id: ProfileId) -> DiscoverySubject:
    if ctx.left.profile.profile_id == profile_id:
        return ctx.left
    if ctx.right.profile.profile_id == profile_id:
        return ctx.right
    raise MatchingDenied("actor is not a pair participant")


def _candidate_for_actor(ctx: MatchingContext, actor_profile_id: ProfileId) -> DiscoveryCandidate:
    if ctx.left.profile.profile_id == actor_profile_id:
        return ctx.right_as_seen_by_left
    if ctx.right.profile.profile_id == actor_profile_id:
        return ctx.left_as_seen_by_right
    raise MatchingDenied("actor is not a pair participant")


def _other(ctx: MatchingContext, actor_profile_id: ProfileId) -> DiscoverySubject:
    if ctx.left.profile.profile_id == actor_profile_id:
        return ctx.right
    if ctx.right.profile.profile_id == actor_profile_id:
        return ctx.left
    raise MatchingDenied("actor is not a pair participant")


def _require_current_like_target(ctx: MatchingContext, actor_profile_id: ProfileId) -> None:
    actor=_subject_for(ctx,actor_profile_id)
    candidate=_candidate_for_actor(ctx,actor_profile_id)
    results=discover(actor,(candidate,),limit=1)
    if len(results)!=1 or results[0].profile_id!=candidate.subject.profile.profile_id:
        raise MatchingDenied("target is not currently authorized for this actor")


def _require_current_reciprocal_pair(ctx: MatchingContext) -> None:
    left_results=discover(ctx.left,(ctx.right_as_seen_by_left,),limit=1)
    right_results=discover(ctx.right,(ctx.left_as_seen_by_right,),limit=1)
    if len(left_results)!=1 or len(right_results)!=1:
        raise MatchingDenied("pair is not currently mutually discoverable")
    require_match_intent(
        DiscoveryMatchingPair(ctx.left.authorization,ctx.right.authorization),
        viewer_token=ctx.left.token,
        viewer_marker=ctx.left.marker,
        candidate_token=ctx.right.token,
        candidate_marker=ctx.right.marker,
    )


def record_like(
    ctx: MatchingContext,
    *,
    actor_profile_id: ProfileId,
    pair: PairRelationship,
    actor_current_generation: int,
) -> tuple[DirectedIntent, RevocationMarker, Invalidation]:
    _require_current_like_target(ctx,actor_profile_id)
    actor=_subject_for(ctx,actor_profile_id)
    if not authorize_relationship_action(actor.authorization.context):
        raise MatchingDenied("actor lacks current relationship authority")
    target=_other(ctx,actor_profile_id)
    expected=canonical_pair(actor.profile.profile_id,target.profile.profile_id,
        state=pair.state,consent_epoch=pair.consent_epoch)
    if expected!=pair:
        raise MatchingDenied("pair does not match participants")
    if pair.state==RelationshipState.BLOCKED:
        raise MatchingDenied("blocked pair cannot receive likes")
    intent=DirectedIntent(actor_profile_id,target.profile.profile_id,RelationshipState.LIKED,pair.consent_epoch)
    marker=next_revocation(str(actor_profile_id),actor_current_generation,"RELATIONSHIP_CHANGED")
    return intent,marker,invalidation_for(marker,CanonicalChange.RELATIONSHIP)


def record_pass(
    ctx: MatchingContext,
    *,
    actor_profile_id: ProfileId,
    pair: PairRelationship,
    actor_current_generation: int,
) -> tuple[DirectedIntent, RevocationMarker, Invalidation]:
    actor=_subject_for(ctx,actor_profile_id)
    if not authorize_relationship_action(actor.authorization.context):
        raise MatchingDenied("actor lacks current relationship authority")
    require_derived_usable(DerivedSurface.MATCHING,actor.token,actor.marker)
    target=_other(ctx,actor_profile_id)
    expected=canonical_pair(actor.profile.profile_id,target.profile.profile_id,
        state=pair.state,consent_epoch=pair.consent_epoch)
    if expected!=pair:
        raise MatchingDenied("pair does not match participants")
    intent=DirectedIntent(actor_profile_id,target.profile.profile_id,RelationshipState.PASSED,pair.consent_epoch)
    marker=next_revocation(str(actor_profile_id),actor_current_generation,"RELATIONSHIP_CHANGED")
    return intent,marker,invalidation_for(marker,CanonicalChange.RELATIONSHIP)


def form_match(
    ctx: MatchingContext,
    *,
    pair: PairRelationship,
    left_intent: DirectedIntent,
    right_intent: DirectedIntent,
    left_current_generation: int,
    right_current_generation: int,
) -> RelationshipMutation:
    _require_current_reciprocal_pair(ctx)
    canonical=canonical_pair(ctx.left.profile.profile_id,ctx.right.profile.profile_id,
        state=pair.state,consent_epoch=pair.consent_epoch)
    if canonical!=pair:
        raise MatchingDenied("pair does not match participants")
    if pair.state in {RelationshipState.MATCHED,RelationshipState.BLOCKED}:
        raise MatchingDenied("pair cannot form a new match in current state")
    expected={(ctx.left.profile.profile_id,ctx.right.profile.profile_id),
              (ctx.right.profile.profile_id,ctx.left.profile.profile_id)}
    actual={(left_intent.actor_profile_id,left_intent.target_profile_id),
            (right_intent.actor_profile_id,right_intent.target_profile_id)}
    if actual!=expected:
        raise MatchingDenied("reciprocal intents do not bind this pair")
    if left_intent.state!=RelationshipState.LIKED or right_intent.state!=RelationshipState.LIKED:
        raise MatchingDenied("both users must independently like")
    if left_intent.consent_epoch!=pair.consent_epoch or right_intent.consent_epoch!=pair.consent_epoch:
        raise MatchingDenied("stale reciprocal intent epoch")
    try:
        state=relationship_transition(RelationshipState.LIKED,RelationshipState.MATCHED,Authority.RECIPROCAL_USERS)
    except TransitionDenied as exc:
        raise MatchingDenied(str(exc)) from exc
    matched=replace(pair,state=state)
    lm=next_revocation(str(matched.left_profile_id),left_current_generation,"RELATIONSHIP_CHANGED")
    rm=next_revocation(str(matched.right_profile_id),right_current_generation,"RELATIONSHIP_CHANGED")
    return RelationshipMutation(
        matched,(lm,rm),
        (invalidation_for(lm,CanonicalChange.RELATIONSHIP),invalidation_for(rm,CanonicalChange.RELATIONSHIP))
    )


def unmatch(
    pair: PairRelationship,
    *,
    actor_profile_id: ProfileId,
    left_current_generation: int,
    right_current_generation: int,
) -> RelationshipMutation:
    if actor_profile_id not in {pair.left_profile_id,pair.right_profile_id}:
        raise MatchingDenied("only participant may unmatch")
    try:
        state=relationship_transition(pair.state,RelationshipState.UNMATCHED,Authority.USER)
    except TransitionDenied as exc:
        raise MatchingDenied(str(exc)) from exc
    updated=PairRelationship(pair.left_profile_id,pair.right_profile_id,state,pair.consent_epoch+1)
    lm=next_revocation(str(pair.left_profile_id),left_current_generation,"UNMATCH")
    rm=next_revocation(str(pair.right_profile_id),right_current_generation,"UNMATCH")
    return RelationshipMutation(
        updated,(lm,rm),
        (invalidation_for(lm,CanonicalChange.UNMATCH),invalidation_for(rm,CanonicalChange.UNMATCH))
    )


def bind_pair_relationship(bound: BoundEligibilityAuthorization, pair: PairRelationship) -> BoundEligibilityAuthorization:
    subject=ProfileId(bound.context.subject_id)
    if subject not in {pair.left_profile_id,pair.right_profile_id}:
        raise MatchingDenied("authorization subject is not pair participant")
    # Canonical BLOCKED pair state must propagate to the generic authorization deny bit
    # so discovery/matching/messaging consumers cannot disagree about block supremacy.
    return replace(
        bound,
        context=replace(
            bound.context,
            relationship=pair.state,
            blocked=(pair.state == RelationshipState.BLOCKED) or bound.context.blocked,
        ),
    )


def encode_intent(intent: DirectedIntent) -> dict[str,object]:
    return {
        "relationship_id":intent.relationship_id,
        "left_profile_id":str(intent.actor_profile_id),
        "right_profile_id":str(intent.target_profile_id),
        "state":intent.state.value,
        "version":intent.consent_epoch,
    }


def decode_intent(values, *, actor_profile_id: ProfileId, target_profile_id: ProfileId) -> DirectedIntent:
    expected={"relationship_id","left_profile_id","right_profile_id","state","version"}
    relationship_id=f"intent:{actor_profile_id}>{target_profile_id}"
    if set(values)!=expected or values.get("relationship_id")!=relationship_id:
        raise MatchingDenied("canonical directional intent required")
    if values.get("left_profile_id")!=str(actor_profile_id) or values.get("right_profile_id")!=str(target_profile_id):
        raise MatchingDenied("directional intent subject mismatch")
    try:
        return DirectedIntent(actor_profile_id,target_profile_id,RelationshipState(str(values["state"])),int(values["version"]))
    except (ValueError,TypeError) as exc:
        raise MatchingDenied("invalid directional intent") from exc


def encode_pair(pair: PairRelationship) -> dict[str,object]:
    return {
        "relationship_id":pair.relationship_id,
        "left_profile_id":str(pair.left_profile_id),
        "right_profile_id":str(pair.right_profile_id),
        "state":pair.state.value,
        "version":pair.consent_epoch,
    }


def decode_pair(values, *, left_profile_id: ProfileId, right_profile_id: ProfileId) -> PairRelationship:
    canonical=canonical_pair(left_profile_id,right_profile_id)
    expected={"relationship_id","left_profile_id","right_profile_id","state","version"}
    if set(values)!=expected or values.get("relationship_id")!=canonical.relationship_id:
        raise MatchingDenied("canonical pair relationship required")
    try:
        return PairRelationship(
            canonical.left_profile_id,canonical.right_profile_id,
            RelationshipState(str(values["state"])),int(values["version"])
        )
    except (ValueError,TypeError) as exc:
        raise MatchingDenied("invalid pair relationship") from exc


def persist_intent(repository, intent: DirectedIntent, *, expected_version: int | None):
    return repository.put("relationship",intent.relationship_id,encode_intent(intent),expected_version=expected_version)


def load_intent(repository, actor_profile_id: ProfileId, target_profile_id: ProfileId):
    key=f"intent:{actor_profile_id}>{target_profile_id}"
    row=repository.get("relationship",key)
    if row is None:
        return None,None
    return decode_intent(row.values,actor_profile_id=actor_profile_id,target_profile_id=target_profile_id),row.version


def persist_pair(repository, pair: PairRelationship, *, expected_version: int | None):
    return repository.put("relationship",pair.relationship_id,encode_pair(pair),expected_version=expected_version)


def load_pair(repository, left_profile_id: ProfileId, right_profile_id: ProfileId):
    canonical=canonical_pair(left_profile_id,right_profile_id)
    row=repository.get("relationship",canonical.relationship_id)
    if row is None:
        return canonical,None
    return decode_pair(row.values,left_profile_id=left_profile_id,right_profile_id=right_profile_id),row.version
