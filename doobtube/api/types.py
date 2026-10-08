"""DOOBTUBE-5 runtime types and stable API contracts."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping
import base64
import json

API_VERSION = "v1"
MAX_PAGE_LIMIT = 100
MAX_IDEMPOTENCY_KEY = 128
MAX_CURSOR_BYTES = 256


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def rfc3339(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("timezone-aware timestamp required")
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def encode_cursor(position: int) -> str:
    if position < 0:
        raise ValueError("cursor position must be non-negative")
    raw = json.dumps({"v": 1, "p": position}, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> int:
    if not cursor:
        return 0
    if len(cursor.encode()) > MAX_CURSOR_BYTES:
        raise ValueError("cursor too long")
    padded = cursor + "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(padded.encode())
    value = json.loads(raw)
    if value.get("v") != 1 or not isinstance(value.get("p"), int) or value["p"] < 0:
        raise ValueError("invalid cursor")
    return value["p"]


@dataclass(frozen=True)
class AuthContext:
    wallet: str | None
    chain_id: int
    network: str
    capabilities: frozenset[str] = field(default_factory=frozenset)

    @property
    def anonymous(self) -> bool:
        return not bool(self.wallet)


@dataclass(frozen=True)
class Request:
    method: str
    path: str
    query: Mapping[str, str] = field(default_factory=dict)
    headers: Mapping[str, str] = field(default_factory=dict)
    body: Mapping[str, Any] = field(default_factory=dict)
    auth: AuthContext | None = None


@dataclass(frozen=True)
class Response:
    status: int
    body: Mapping[str, Any]
    headers: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class ProjectionEvent:
    media_asset_id: str
    block_height: int
    block_hash: str
    parent_hash: str
    finalized_height: int
    media_state: str
    visibility: str
    rights_authorized: bool
    title: str
    creator_ref: str
    observed_at: datetime
