"""PB-1.3 canonical private persistence schema declarations.

This is a storage-neutral logical schema. It deliberately defines no database engine,
migration, API, deployment, public-chain representation, fixed address, or service ID.
"""
from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet

class Sensitivity(str, Enum):
    PRIVATE = "PRIVATE"
    HIGHLY_SENSITIVE = "HIGHLY_SENSITIVE"
    PROTECTED_SAFETY = "PROTECTED_SAFETY"

class DeleteClass(str, Enum):
    ORDINARY_DELETE = "ORDINARY_DELETE"
    PURPOSE_LIMITED_RETENTION = "PURPOSE_LIMITED_RETENTION"

@dataclass(frozen=True)
class TableSpec:
    name: str
    owner: str
    sensitivity: Sensitivity
    delete_class: DeleteClass
    fields: FrozenSet[str]
    forbidden_fields: FrozenSet[str] = frozenset()

COMMON_FORBIDDEN=frozenset({
    "wallet_private_key","seed_phrase","mnemonic","government_id_image","date_of_birth",
    "raw_identity_document","public_profile_id","public_wallet_link"
})

TABLES={
"profile":TableSpec("profile","puffbuddies",Sensitivity.PRIVATE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","mode","lifecycle","display_fields","media_refs","visibility_version"}),COMMON_FORBIDDEN),
"eligibility_projection":TableSpec("eligibility_projection","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","decision","source_version","expires_at","policy_version","sequence","checked_at_epoch"}),COMMON_FORBIDDEN|frozenset({"raw_identity_evidence","raw_proof","proof_bytes","credential_payload"})),
"preferences":TableSpec("preferences","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","discovery_modes","distance_band","compatibility","visibility_version"}),COMMON_FORBIDDEN),
"visibility":TableSpec("visibility","puffbuddies",Sensitivity.PRIVATE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","field_key","audience","version"}),COMMON_FORBIDDEN),
"verification":TableSpec("verification","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","kind","source","source_version","state","issued_at_epoch","expires_at_epoch","user_visible","version"}),
 COMMON_FORBIDDEN|frozenset({"proof_bytes","credential_payload","government_id_image","biometric_template","wallet_address",
 "reputation_score","trust_score","desirability_score","report_count","block_count","moderation_history","risk_score"})),
"relationship":TableSpec("relationship","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"relationship_id","left_profile_id","right_profile_id","state","version"}),COMMON_FORBIDDEN),
"safety":TableSpec("safety","puffbuddies",Sensitivity.PROTECTED_SAFETY,DeleteClass.PURPOSE_LIMITED_RETENTION,
 frozenset({"case_id","subject_profile_id","actor_profile_id","report_class","evidence_digest","evidence_ref",
 "policy_basis","action","status","moderator_actor_id","retention_reason","version"}),
 COMMON_FORBIDDEN|frozenset({"raw_report","raw_evidence","message_body","private_message","reporter_contact"})),
"lifecycle":TableSpec("lifecycle","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","state","version"}),COMMON_FORBIDDEN),
"location":TableSpec("location","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","encrypted_location_ref","coarse_discovery_cell","version"}),COMMON_FORBIDDEN|frozenset({"public_latitude","public_longitude","raw_gps_history"})),
"cannabis":TableSpec("cannabis","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","use_status","methods","contexts","boundaries","partner_compatibility","visibility_version"}),COMMON_FORBIDDEN),
"matching_input":TableSpec("matching_input","puffbuddies",Sensitivity.HIGHLY_SENSITIVE,DeleteClass.ORDINARY_DELETE,
 frozenset({"profile_id","version","eligibility_version","profile_version","preference_version","safety_version","location_version"}),COMMON_FORBIDDEN),
}

PUBLIC_TABLES=frozenset()
EXTERNAL_CANONICAL_TABLES=frozenset()
DERIVED_ONLY=frozenset({"discovery_results","recommendation_scores","analytics_profiles","search_profiles","public_match_graph"})
