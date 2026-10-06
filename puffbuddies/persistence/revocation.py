"""PB-1.8 deletion/revocation foundations.

A monotonic revocation generation is canonical for invalidating stale records,
projections, caches, restores and backups. Safety retention remains purpose-limited.
"""
from dataclasses import dataclass
from typing import Iterable
from puffbuddies.persistence.schema import TABLES,DeleteClass
from puffbuddies.domain.repositories import StoredRecord,VersionConflict

class RevocationDenied(ValueError): pass

@dataclass(frozen=True)
class RevocationMarker:
    subject_id:str
    generation:int
    reason:str
    deletion_complete:bool=False
    def __post_init__(self):
        if not self.subject_id or self.generation < 1 or not self.reason or len(self.reason)>64:
            raise RevocationDenied("bounded subject, generation and reason required")

@dataclass(frozen=True)
class DerivedAuthorityToken:
    subject_id:str
    generation:int

def next_revocation(subject_id:str,current_generation:int,reason:str,*,deletion_complete:bool=False)->RevocationMarker:
    if current_generation < 0: raise RevocationDenied("invalid current generation")
    return RevocationMarker(subject_id,current_generation+1,reason,deletion_complete)

def token_current(token:DerivedAuthorityToken,marker:RevocationMarker)->bool:
    return token.subject_id==marker.subject_id and token.generation==marker.generation and not marker.deletion_complete

def require_current_token(token:DerivedAuthorityToken,marker:RevocationMarker)->None:
    if not token_current(token,marker): raise RevocationDenied("stale or deleted derived authority")

def restore_allowed(snapshot_generation:int,marker:RevocationMarker)->bool:
    return not marker.deletion_complete and snapshot_generation>=marker.generation

def require_restore_allowed(snapshot_generation:int,marker:RevocationMarker)->None:
    if not restore_allowed(snapshot_generation,marker): raise RevocationDenied("restore would resurrect revoked authority")

def deletion_plan(*,include_safety:bool=False)->tuple[str,...]:
    ordinary=tuple(sorted(name for name,spec in TABLES.items() if spec.delete_class==DeleteClass.ORDINARY_DELETE))
    if include_safety: raise RevocationDenied("purpose-limited safety retention cannot be bulk-deleted as ordinary state")
    return ordinary

def retained_safety_fields(values:dict[str,object])->dict[str,object]:
    allowed=set(TABLES["safety"].fields)
    if set(values)-allowed: raise RevocationDenied("noncanonical safety retention material")
    if not values.get("retention_reason"): raise RevocationDenied("purpose-limited retention reason required")
    return dict(values)

def purge_subject(repository,records:Iterable[StoredRecord])->None:
    staged=list(records)
    for r in staged:
        if r.table=="safety": raise RevocationDenied("safety requires separate purpose-limited retention handling")
        if r.table not in deletion_plan(): raise RevocationDenied("non-ordinary deletion target")
    for r in staged:
        repository.delete(r.table,r.key,expected_version=r.version)

def reject_stale_write_after_revocation(*,write_generation:int,marker:RevocationMarker)->None:
    if write_generation < marker.generation or marker.deletion_complete:
        raise VersionConflict("write predates revocation or subject deletion is complete")
