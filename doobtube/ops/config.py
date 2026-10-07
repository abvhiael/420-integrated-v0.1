"""DOOBTUBE-10 non-production deployment configuration."""
from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import json
from pathlib import Path

LOOPBACK_NAMES={"localhost","127.0.0.1","::1"}

@dataclass(frozen=True)
class NonProductionConfig:
    host: str
    port: int
    chain_id: int
    network: str
    database_path: str
    web_root: str
    media_available: bool=False
    registry_available: bool=False

    @classmethod
    def load(cls,path: str | Path) -> "NonProductionConfig":
        raw=json.loads(Path(path).read_text(encoding="utf-8"))
        if raw.get("schema")!="doobtube-nonproduction-v1":
            raise ValueError("non-production schema mismatch")
        if raw.get("production") is not False:
            raise ValueError("non-production config must set production=false")
        bind=raw.get("bind") or {}
        runtime=raw.get("runtime") or {}
        deps=raw.get("dependencies") or {}
        cfg=cls(
            host=str(bind.get("host") or ""),
            port=int(bind.get("port") or 0),
            chain_id=int(runtime.get("chainId") or 0),
            network=str(runtime.get("network") or ""),
            database_path=str(runtime.get("databasePath") or ""),
            web_root=str(runtime.get("webRoot") or ""),
            media_available=bool(deps.get("420Media",False)),
            registry_available=bool(deps.get("420Registry",False)),
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        host=self.host.strip().lower()
        if host not in LOOPBACK_NAMES:
            try:
                if not ipaddress.ip_address(host).is_loopback:
                    raise ValueError("non-production launcher is loopback-only")
            except ValueError as exc:
                if str(exc)=="non-production launcher is loopback-only":
                    raise
                raise ValueError("non-production launcher is loopback-only") from exc
        if self.port<1 or self.port>65535:
            raise ValueError("valid loopback port required")
        if self.chain_id<=0 or not self.network.strip():
            raise ValueError("chain/network required")
        if not self.database_path.strip() or not self.web_root.strip():
            raise ValueError("databasePath and webRoot required")
