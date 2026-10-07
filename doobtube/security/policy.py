"""DOOBTUBE-9 app-scoped abuse, privacy and logging policy."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import re
import threading
from typing import Any, Callable, Mapping

class SecurityDenied(PermissionError):
    pass

@dataclass(frozen=True)
class AbusePolicy:
    limit: int
    window_seconds: int

    def __post_init__(self):
        if self.limit <= 0 or self.limit > 10000:
            raise ValueError("bounded abuse limit required")
        if self.window_seconds <= 0 or self.window_seconds > 86400:
            raise ValueError("bounded abuse window required")

DEFAULT_POLICIES: Mapping[str, AbusePolicy] = {
    "preferences.write": AbusePolicy(30, 60),
    "control.rebuild": AbusePolicy(5, 60),
    "operator.metrics": AbusePolicy(120, 60),
}

class AbuseGuard:
    """Per-process actor+operation limiter.

    Deployment edge/network rate limiting remains mandatory later; this guard
    prevents a single authorized actor from bypassing all app-level bounds.
    """
    def __init__(
        self,
        policies: Mapping[str, AbusePolicy] | None = None,
        *,
        now: Callable[[], datetime],
    ):
        self.policies=dict(policies or DEFAULT_POLICIES)
        self.now=now
        self._lock=threading.Lock()
        self._windows: dict[tuple[str,str], tuple[datetime,int]]={}

    def require(self, actor: str, operation: str) -> None:
        actor=str(actor or "").strip().lower()
        if not actor:
            raise SecurityDenied("actor required for abuse control")
        policy=self.policies.get(operation)
        if policy is None:
            raise SecurityDenied("operation has no abuse policy")
        now=self.now()
        key=(actor,operation)
        with self._lock:
            start,used=self._windows.get(key,(now,0))
            if now >= start + timedelta(seconds=policy.window_seconds):
                start,used=now,0
            if used >= policy.limit:
                self._windows[key]=(start,used)
                raise SecurityDenied("rate limited")
            self._windows[key]=(start,used+1)

SECRET_FIELD=re.compile(r"(private.?key|seed.?phrase|mnemonic|password|raw.?secret|authorization.?token|api.?key|stream.?key)",re.I)
BEARER=re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
SECRET_REF=re.compile(r"(?i)\b(secret|vault|keyring)://[^\s'\"<>]+")
URL_USERINFO=re.compile(r"(?i)(https?|rtmps?|srt|webrtc)://[^\s/@:]+:[^\s/@]+@")
QUERY_SECRET=re.compile(r"(?i)([?&](?:token|key|secret|password|signature)=)[^&#\s]+")

def redact_sensitive_text(value: object, max_chars: int=500) -> str:
    text=str(value or "")
    text=BEARER.sub("Bearer [REDACTED]",text)
    text=SECRET_REF.sub(lambda m: m.group(1).lower()+"://[REDACTED]",text)
    text=URL_USERINFO.sub(lambda m: m.group(1)+"://[REDACTED]@",text)
    text=QUERY_SECRET.sub(lambda m: m.group(1)+"[REDACTED]",text)
    return text[:max_chars]

def assert_no_secret_fields(value: Any, path: str="root") -> None:
    if isinstance(value, Mapping):
        for key,item in value.items():
            if SECRET_FIELD.search(str(key)):
                raise SecurityDenied(f"secret-like field forbidden at {path}.{key}")
            assert_no_secret_fields(item,f"{path}.{key}")
    elif isinstance(value,(list,tuple,set)):
        for index,item in enumerate(value):
            assert_no_secret_fields(item,f"{path}[{index}]")
