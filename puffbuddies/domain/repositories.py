"""PB-1.4 domain-owned persistence interfaces.

Adapters implement these interfaces; they do not own PuffBuddies authority.
"""
from dataclasses import dataclass
from typing import Mapping, Optional, Protocol

@dataclass(frozen=True)
class StoredRecord:
    table: str
    key: str
    version: int
    values: Mapping[str, object]

class VersionConflict(RuntimeError): pass
class UnknownCanonicalTable(ValueError): pass
class InvalidRecord(ValueError): pass

class PrivateRepository(Protocol):
    def get(self, table: str, key: str) -> Optional[StoredRecord]: ...
    def put(self, table: str, key: str, values: Mapping[str, object], *, expected_version: Optional[int]) -> StoredRecord: ...
    def delete(self, table: str, key: str, *, expected_version: int) -> None: ...
