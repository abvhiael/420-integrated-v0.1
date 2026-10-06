"""PB-1.7 storage-neutral migration/evolution rules.

Migrations transform canonical private records only. They must never widen visibility,
restore deleted/revoked authority, synthesize consent, or introduce forbidden fields.
"""
from dataclasses import dataclass
from typing import Callable,Mapping
from puffbuddies.persistence.schema import TABLES,DERIVED_ONLY
from puffbuddies.domain.repositories import InvalidRecord

class MigrationDenied(ValueError): pass
@dataclass(frozen=True)
class Migration:
    table:str; from_version:int; to_version:int; transform:Callable[[Mapping[str,object]],Mapping[str,object]]
    def __post_init__(self):
        if self.table not in TABLES or self.table in DERIVED_ONLY: raise MigrationDenied("noncanonical table")
        if self.from_version < 1 or self.to_version != self.from_version+1: raise MigrationDenied("migrations must be single-step monotonic")

FORBIDDEN_AUTHORITY_STATES=frozenset({"MATCHED","ACTIVE"})
REVOKED_STATES=frozenset({"UNMATCHED","BLOCKED","DEACTIVATED","SUSPENDED","BANNED","DELETE_REQUESTED","DELETION_IN_PROGRESS","DELETION_COMPLETE","RETAINED_EVIDENCE_ONLY"})

def _validate_fields(table,values):
    spec=TABLES[table]; fields=set(values)
    if fields-set(spec.fields): raise InvalidRecord("migration introduced noncanonical field")
    if fields&set(spec.forbidden_fields): raise InvalidRecord("migration introduced forbidden field")

def apply_migration(m:Migration,record:Mapping[str,object])->dict[str,object]:
    before=dict(record); _validate_fields(m.table,before)
    after=dict(m.transform(dict(before))); _validate_fields(m.table,after)
    # Identity/key material cannot be rewritten by schema evolution.
    for key in ("profile_id","relationship_id","case_id","left_profile_id","right_profile_id"):
        if key in before and after.get(key)!=before[key]: raise MigrationDenied("canonical identity rewrite")
    # Evolution may preserve/restrict authority but cannot resurrect or manufacture it.
    bstate=before.get("state"); astate=after.get("state")
    if bstate in REVOKED_STATES and astate in FORBIDDEN_AUTHORITY_STATES: raise MigrationDenied("revoked authority resurrection")
    if m.table=="relationship" and bstate!="MATCHED" and astate=="MATCHED": raise MigrationDenied("migration cannot manufacture match consent")
    # Visibility migrations cannot silently widen an existing audience.
    order={"NEVER_PUBLIC":0,"PRIVATE_SELF":1,"MODERATOR_ONLY":1,"SERVICE_MINIMUM":1,"PARTICIPANT_ONLY":2,"MATCHED":2,"DISCOVERABLE":3,"AGGREGATE_ONLY":3,"PUBLIC_EXPLICIT":4}
    if m.table=="visibility" and before.get("audience") in order and after.get("audience") in order and order[after["audience"]]>order[before["audience"]]:
        raise MigrationDenied("visibility widening requires explicit product authority, not migration")
    return after

def backfill(m:Migration,records:list[Mapping[str,object]])->list[dict[str,object]]:
    # Atomic-by-construction staging: return nothing unless every record validates.
    staged=[apply_migration(m,r) for r in records]
    return staged
