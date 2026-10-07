"""PB-10 Payments and premium entitlements.

420Pay owns payment/settlement truth. PuffBuddies owns only the product-specific
conclusion that a bounded convenience/presentation feature entitlement is active.

Payment/premium state is never consent, eligibility, lifecycle, match, block override,
message permission, safety authority, or access to another user's protected data.
"""
from dataclasses import dataclass, replace
from enum import Enum
from typing import Iterable, Mapping, Protocol

from puffbuddies.domain.types import LifecycleState, ProfileId


PAY_SERVICE_ID = "420/service/pay/v1"


class PremiumDenied(PermissionError):
    pass


class PayDependencyUnavailable(RuntimeError):
    pass


class PayStatus(str, Enum):
    NONE="NONE"; SUBMITTED="SUBMITTED"; INCLUDED="INCLUDED"; CERTIFIED="CERTIFIED"
    FINALIZED="FINALIZED"; SETTLED="SETTLED"; REFUNDED="REFUNDED"
    PARTIALLY_REFUNDED="PARTIALLY_REFUNDED"; FAILED="FAILED"


class PremiumFeature(str, Enum):
    ADVANCED_FILTERS="ADVANCED_FILTERS"
    LIKED_YOU="LIKED_YOU"
    INCOGNITO="INCOGNITO"
    PROFILE_CUSTOMIZATION="PROFILE_CUSTOMIZATION"
    UNDO_REWIND="UNDO_REWIND"
    COSMETIC="COSMETIC"


class EntitlementState(str, Enum):
    ACTIVE="ACTIVE"; REVOKED="REVOKED"; EXPIRED="EXPIRED"


@dataclass(frozen=True)
class PremiumOffer:
    offer_id: str
    invoice_ref: str
    merchant_ref: str
    settlement_asset_ref: str
    settlement_amount: int
    features: frozenset[PremiumFeature]
    term_seconds: int
    policy_version: str

    def __post_init__(self):
        for name,value,limit in (
            ("offer_id",self.offer_id,128),("invoice_ref",self.invoice_ref,160),
            ("merchant_ref",self.merchant_ref,160),("settlement_asset_ref",self.settlement_asset_ref,160),
            ("policy_version",self.policy_version,96),
        ):
            if not value or len(value)>limit or any(ch.isspace() for ch in value):
                raise PremiumDenied(f"bounded {name} required")
        if self.settlement_amount<=0 or self.term_seconds<=0:
            raise PremiumDenied("positive settlement amount and term required")
        if not self.features:
            raise PremiumDenied("offer must grant at least one bounded feature")


@dataclass(frozen=True)
class PaymentSettlementSnapshot:
    payment_ref: str
    invoice_ref: str
    payer_ref: str
    merchant_ref: str
    settlement_asset_ref: str
    settlement_amount: int
    refunded_amount: int
    status: PayStatus
    source_version: str
    observed_at_epoch: int

    def __post_init__(self):
        for name,value in (
            ("payment_ref",self.payment_ref),("invoice_ref",self.invoice_ref),
            ("payer_ref",self.payer_ref),("merchant_ref",self.merchant_ref),
            ("settlement_asset_ref",self.settlement_asset_ref),("source_version",self.source_version),
        ):
            if not value or len(value)>192 or any(ch.isspace() for ch in value):
                raise PremiumDenied(f"bounded {name} required")
        if self.settlement_amount<0 or self.refunded_amount<0 or self.observed_at_epoch<0:
            raise PremiumDenied("nonnegative payment values required")
        if self.refunded_amount>self.settlement_amount:
            raise PremiumDenied("refund cannot exceed settlement")


@dataclass(frozen=True)
class PaymentAccountBinding:
    profile_id: ProfileId
    payer_ref: str

    def __post_init__(self):
        if not str(self.profile_id) or not self.payer_ref or len(self.payer_ref)>192 or any(ch.isspace() for ch in self.payer_ref):
            raise PremiumDenied("bounded transient payer binding required")


class PayAuthorityReader(Protocol):
    def payment(self, payment_ref: str) -> PaymentSettlementSnapshot | None: ...


@dataclass(frozen=True)
class PremiumEntitlement:
    profile_id: ProfileId
    feature: PremiumFeature
    offer_id: str
    state: EntitlementState
    policy_version: str
    source_version: str
    issued_at_epoch: int
    expires_at_epoch: int
    version: int = 1

    def __post_init__(self):
        if not str(self.profile_id):
            raise PremiumDenied("profile required")
        if not self.offer_id or len(self.offer_id)>128 or any(ch.isspace() for ch in self.offer_id):
            raise PremiumDenied("bounded offer id required")
        if not self.policy_version or not self.source_version:
            raise PremiumDenied("policy/source versions required")
        if self.issued_at_epoch<0 or self.expires_at_epoch<=self.issued_at_epoch:
            raise PremiumDenied("bounded entitlement lifetime required")
        if self.version<1:
            raise PremiumDenied("positive entitlement version required")

    @property
    def key(self)->str:
        return f"{self.profile_id}:{self.feature.value}"


def _read_payment(reader:PayAuthorityReader,payment_ref:str)->PaymentSettlementSnapshot:
    try:
        p=reader.payment(payment_ref)
    except Exception as exc:
        raise PayDependencyUnavailable("420Pay authority unavailable") from exc
    if p is None:
        raise PremiumDenied("canonical 420Pay payment required")
    if p.payment_ref!=payment_ref:
        raise PremiumDenied("payment identity mismatch")
    return p


def _payment_matches_offer(payment:PaymentSettlementSnapshot,offer:PremiumOffer)->bool:
    return (
        payment.invoice_ref==offer.invoice_ref
        and payment.merchant_ref==offer.merchant_ref
        and payment.settlement_asset_ref==offer.settlement_asset_ref
        and payment.settlement_amount==offer.settlement_amount
    )


def grant_entitlements(
    *,
    profile_id:ProfileId,
    account_binding:PaymentAccountBinding,
    offer:PremiumOffer,
    payment_ref:str,
    reader:PayAuthorityReader,
    now_epoch:int,
    current_policy_version:str,
)->tuple[PremiumEntitlement,...]:
    if account_binding.profile_id!=profile_id:
        raise PremiumDenied("payer/profile binding mismatch")
    if current_policy_version!=offer.policy_version:
        raise PremiumDenied("stale premium policy")
    payment=_read_payment(reader,payment_ref)
    if payment.payer_ref!=account_binding.payer_ref:
        raise PremiumDenied("payment payer does not match transient profile binding")
    if not _payment_matches_offer(payment,offer):
        raise PremiumDenied("payment does not bind canonical premium offer")
    if payment.status!=PayStatus.SETTLED or payment.refunded_amount!=0:
        raise PremiumDenied("only fully settled non-refunded payment grants entitlement")
    if payment.observed_at_epoch>now_epoch:
        raise PremiumDenied("future payment observation")
    expires=now_epoch+offer.term_seconds
    return tuple(
        PremiumEntitlement(
            profile_id,feature,offer.offer_id,EntitlementState.ACTIVE,
            offer.policy_version,payment.source_version,now_epoch,expires,1,
        )
        for feature in sorted(offer.features,key=lambda f:f.value)
    )


def reconcile_entitlement(
    entitlement:PremiumEntitlement,
    *,
    offer:PremiumOffer,
    payment_ref:str,
    account_binding:PaymentAccountBinding,
    reader:PayAuthorityReader,
    now_epoch:int,
    current_policy_version:str,
)->PremiumEntitlement:
    if entitlement.profile_id!=account_binding.profile_id or entitlement.offer_id!=offer.offer_id:
        raise PremiumDenied("entitlement context mismatch")
    if entitlement.feature not in offer.features:
        raise PremiumDenied("feature no longer belongs to offer")
    if current_policy_version!=entitlement.policy_version or current_policy_version!=offer.policy_version:
        return replace(entitlement,state=EntitlementState.REVOKED,version=entitlement.version+1)
    payment=_read_payment(reader,payment_ref)
    if payment.payer_ref!=account_binding.payer_ref or not _payment_matches_offer(payment,offer):
        raise PremiumDenied("payment binding mismatch")
    if now_epoch>=entitlement.expires_at_epoch:
        return replace(entitlement,state=EntitlementState.EXPIRED,version=entitlement.version+1)
    if payment.status!=PayStatus.SETTLED or payment.refunded_amount!=0:
        return replace(entitlement,state=EntitlementState.REVOKED,version=entitlement.version+1)
    if payment.observed_at_epoch>now_epoch:
        raise PremiumDenied("future payment observation")
    return entitlement


def feature_allowed(
    entitlement:PremiumEntitlement,
    *,
    profile_id:ProfileId,
    feature:PremiumFeature,
    lifecycle:LifecycleState,
    now_epoch:int,
    current_policy_version:str,
)->bool:
    if entitlement.profile_id!=profile_id or entitlement.feature!=feature:
        return False
    if entitlement.state!=EntitlementState.ACTIVE:
        return False
    if entitlement.policy_version!=current_policy_version:
        return False
    if now_epoch>=entitlement.expires_at_epoch:
        return False
    # Premium never activates/reactivates or bypasses lifecycle/safety.
    return lifecycle==LifecycleState.ACTIVE


def entitlement_features(
    entitlements:Iterable[PremiumEntitlement],
    *,
    profile_id:ProfileId,
    lifecycle:LifecycleState,
    now_epoch:int,
    current_policy_version:str,
)->frozenset[PremiumFeature]:
    out=set()
    for e in entitlements:
        if feature_allowed(e,profile_id=profile_id,feature=e.feature,lifecycle=lifecycle,
                           now_epoch=now_epoch,current_policy_version=current_policy_version):
            out.add(e.feature)
    return frozenset(out)


def encode_entitlement(e:PremiumEntitlement)->dict[str,object]:
    # Deliberately excludes payment_ref, invoice_ref, payer/wallet account and receipt hash.
    return {
        "profile_id":str(e.profile_id),"feature":e.feature.value,"offer_id":e.offer_id,
        "state":e.state.value,"policy_version":e.policy_version,"source_version":e.source_version,
        "issued_at_epoch":e.issued_at_epoch,"expires_at_epoch":e.expires_at_epoch,"version":e.version,
    }


def decode_entitlement(values:Mapping[str,object],*,profile_id:ProfileId,feature:PremiumFeature)->PremiumEntitlement:
    expected={"profile_id","feature","offer_id","state","policy_version","source_version",
              "issued_at_epoch","expires_at_epoch","version"}
    if set(values)!=expected or values.get("profile_id")!=str(profile_id) or values.get("feature")!=feature.value:
        raise PremiumDenied("canonical premium entitlement required")
    try:
        return PremiumEntitlement(profile_id,feature,str(values["offer_id"]),
            EntitlementState(str(values["state"])),str(values["policy_version"]),str(values["source_version"]),
            int(values["issued_at_epoch"]),int(values["expires_at_epoch"]),int(values["version"]))
    except (ValueError,TypeError) as exc:
        raise PremiumDenied("invalid premium entitlement") from exc


def persist_entitlement(repository,e:PremiumEntitlement,*,expected_version:int|None):
    return repository.put("entitlement",e.key,encode_entitlement(e),expected_version=expected_version)


def load_entitlement(repository,profile_id:ProfileId,feature:PremiumFeature):
    key=f"{profile_id}:{feature.value}"
    row=repository.get("entitlement",key)
    if row is None:return None,None
    return decode_entitlement(row.values,profile_id=profile_id,feature=feature),row.version


def assert_entitlement_not_interpersonal_authority(values:Mapping[str,object])->None:
    forbidden={
        "relationship","match","like","block_override","messaging_authorized","eligibility",
        "safety_override","private_profile_access","location_access","message_access",
        "report_access","moderation_access","wallet_address","payer_ref","payment_ref","receipt_hash",
    }
    if forbidden & set(values):
        raise PremiumDenied("premium entitlement cannot contain interpersonal/payment identity authority")
