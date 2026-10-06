"""PB-1.4 in-memory private persistence adapter for qualification.

This adapter is intentionally non-production and non-durable. It demonstrates the
repository contract without selecting a database engine or creating migration authority.
"""
from typing import Mapping, Optional
from puffbuddies.domain.repositories import InvalidRecord, StoredRecord, UnknownCanonicalTable, VersionConflict
from puffbuddies.persistence.schema import DERIVED_ONLY, TABLES

class InMemoryPrivateRepository:
    def __init__(self):
        self._records: dict[tuple[str,str], StoredRecord] = {}

    @staticmethod
    def _spec(table: str):
        if table not in TABLES or table in DERIVED_ONLY:
            raise UnknownCanonicalTable(table)
        return TABLES[table]

    @classmethod
    def _validate(cls, table: str, values: Mapping[str, object]) -> None:
        spec=cls._spec(table)
        fields=set(values)
        if fields - set(spec.fields):
            raise InvalidRecord(f"noncanonical fields: {sorted(fields-set(spec.fields))}")
        if fields & set(spec.forbidden_fields):
            raise InvalidRecord("forbidden private/identity/secret field")
        if not fields:
            raise InvalidRecord("empty canonical record")

    def get(self, table: str, key: str) -> Optional[StoredRecord]:
        self._spec(table)
        return self._records.get((table,key))

    def put(self, table: str, key: str, values: Mapping[str, object], *, expected_version: Optional[int]) -> StoredRecord:
        self._validate(table,values)
        current=self._records.get((table,key))
        actual=None if current is None else current.version
        if actual != expected_version:
            raise VersionConflict(f"expected {expected_version}, current {actual}")
        version=1 if current is None else current.version+1
        row=StoredRecord(table,key,version,dict(values))
        self._records[(table,key)]=row
        return row

    def delete(self, table: str, key: str, *, expected_version: int) -> None:
        self._spec(table)
        current=self._records.get((table,key))
        if current is None or current.version != expected_version:
            raise VersionConflict("stale or missing delete")
        del self._records[(table,key)]
