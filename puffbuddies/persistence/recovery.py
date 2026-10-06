"""PB-1.12 storage-neutral failure/recovery qualification primitives."""
from dataclasses import dataclass
from typing import Callable,Iterable
from puffbuddies.domain.repositories import StoredRecord,VersionConflict
from puffbuddies.persistence.revocation import RevocationMarker,require_restore_allowed

class AuthorityUnavailable(RuntimeError): pass
class RecoveryFailed(RuntimeError): pass

@dataclass(frozen=True)
class Snapshot:
    generation:int
    records:tuple[StoredRecord,...]

def authoritative_read(repository,table:str,key:str):
    if repository is None: raise AuthorityUnavailable("authoritative persistence unavailable")
    try: return repository.get(table,key)
    except (ConnectionError,TimeoutError,OSError) as exc: raise AuthorityUnavailable("authoritative persistence unavailable") from exc

def staged_batch(repository,operations:Iterable[Callable[[],object]])->tuple[object,...]:
    # Foundation contract: validation/staging happens before caller publishes authority.
    # A production adapter must supply a real transaction; this helper deliberately
    # refuses to claim rollback for a nontransactional adapter.
    if repository is None: raise AuthorityUnavailable("authoritative persistence unavailable")
    staged=[]
    for op in operations:
        try: staged.append(op())
        except Exception as exc: raise RecoveryFailed("batch failed; caller must not publish derived authority") from exc
    return tuple(staged)

def validate_replica(record:StoredRecord|None,authoritative:StoredRecord|None)->bool:
    if authoritative is None: return record is None
    return record is not None and record.table==authoritative.table and record.key==authoritative.key and record.version==authoritative.version and dict(record.values)==dict(authoritative.values)

def require_current_replica(record,authoritative)->None:
    if not validate_replica(record,authoritative): raise RecoveryFailed("stale/conflicting replica")

def validate_restore(snapshot:Snapshot,marker:RevocationMarker)->tuple[StoredRecord,...]:
    require_restore_allowed(snapshot.generation,marker)
    seen=set()
    for r in snapshot.records:
        k=(r.table,r.key)
        if k in seen: raise RecoveryFailed("conflicting duplicate snapshot record")
        seen.add(k)
    return snapshot.records

def rollback_plan(before:Iterable[StoredRecord],after:Iterable[StoredRecord])->tuple[StoredRecord,...]:
    # Recovery source is the complete known-good pre-operation image, never a partial after-image.
    prior=tuple(before); changed=tuple(after)
    if not prior and changed: raise RecoveryFailed("no known-good rollback image")
    return prior
