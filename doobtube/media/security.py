"""DOOBTUBE-6 media, delivery and egress security policy."""
from __future__ import annotations
import ipaddress
import re
from urllib.parse import urlparse
from typing import Callable, Iterable

from .types import (
    MAX_CREDENTIAL_REF_BYTES, MAX_ENDPOINT_BYTES, MAX_SESSION_SECONDS, MAX_UPLOAD_BYTES,
    LivestreamSpec, ProcessingProfile, StorageManifest, UploadInspection, UploadPlan,
)

class MediaRejected(ValueError): pass
class UnsafeEndpoint(MediaRejected): pass
class ManifestRejected(MediaRejected): pass
class ScannerRejected(MediaRejected): pass
class ProviderRejected(MediaRejected): pass

VIDEO_MIME = re.compile(r"^video/[a-z0-9.+-]{1,64}$")
HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")
PROFILE_ID = re.compile(r"^[A-Za-z0-9._:-]{1,96}$")
ALLOWED_ENGINES = {"ffmpeg", "gstreamer"}
ALLOWED_VIDEO = {"copy", "h264", "h265", "av1", "vp9", ""}
ALLOWED_AUDIO = {"copy", "aac", "opus", ""}
ALLOWED_CONTAINERS = {"mp4", "matroska", "mpegts", "webm"}

def validate_upload(item: UploadInspection) -> None:
    mime=item.mime_type.strip().lower().split(";",1)[0]
    if not item.asset_id.strip() or not item.source_ref.strip():
        raise MediaRejected("asset/source reference required")
    if not VIDEO_MIME.fullmatch(mime):
        raise MediaRejected("video MIME required")
    if item.size_bytes <= 0 or item.size_bytes > MAX_UPLOAD_BYTES:
        raise MediaRejected("upload exceeds bounded content policy")
    if not HEX64.fullmatch(item.sha256.strip()):
        raise MediaRejected("valid SHA-256 required")

def _unsafe_ip(value: str) -> bool:
    try: ip=ipaddress.ip_address(value)
    except ValueError: return False
    return (
        ip.is_loopback or ip.is_private or ip.is_unspecified or ip.is_link_local
        or ip.is_multicast or getattr(ip, "is_reserved", False)
    )

def validate_endpoint(
    raw: str,
    allowed_schemes: Iterable[str],
    *,
    resolver: Callable[[str], list[str]] | None,
    allow_loopback_dev: bool=False,
) -> str:
    if not raw or len(raw.encode()) > MAX_ENDPOINT_BYTES:
        raise UnsafeEndpoint("bounded endpoint required")
    u=urlparse(raw.strip())
    schemes={x.lower() for x in allowed_schemes}
    if u.scheme.lower() not in schemes or not u.hostname or u.username is not None or u.password is not None or u.fragment:
        raise UnsafeEndpoint("invalid endpoint")
    host=u.hostname.rstrip(".").lower()
    if host=="localhost" or host.endswith(".localhost") or host.endswith(".local"):
        if not allow_loopback_dev:
            raise UnsafeEndpoint("local hostname denied")
    if _unsafe_ip(host) and not (allow_loopback_dev and ipaddress.ip_address(host).is_loopback):
        raise UnsafeEndpoint("unsafe IP denied")
    if resolver is None:
        raise UnsafeEndpoint("DNS-aware resolver required")
    addrs=resolver(host)
    if not addrs:
        raise UnsafeEndpoint("unresolved endpoint")
    for addr in addrs:
        if _unsafe_ip(addr):
            ip=ipaddress.ip_address(addr)
            if not (allow_loopback_dev and ip.is_loopback):
                raise UnsafeEndpoint("resolved unsafe IP denied")
    return raw.strip()

def validate_upload_plan(plan: UploadPlan, inspection: UploadInspection, *, resolver) -> None:
    if plan.asset_id != inspection.asset_id or plan.size_bytes != inspection.size_bytes:
        raise MediaRejected("upload plan asset/size mismatch")
    for value in (plan.object_id, plan.manifest_id, plan.shard_root, plan.commitment_id, plan.upload_id, plan.idempotency_key):
        if not str(value).strip():
            raise MediaRejected("complete canonical upload identity required")
    if plan.shard_index < 0:
        raise MediaRejected("invalid shard index")
    validate_endpoint(plan.endpoint, {"https"}, resolver=resolver)

def validate_manifest(plan: UploadPlan, manifest: StorageManifest) -> None:
    exact=(
        manifest.object_id==plan.object_id and manifest.manifest_id==plan.manifest_id
        and manifest.shard_index==plan.shard_index and manifest.shard_root.lower()==plan.shard_root.lower()
        and manifest.size_bytes==plan.size_bytes and manifest.commitment_id==plan.commitment_id
    )
    if not exact:
        raise ManifestRejected("canonical manifest identity mismatch")
    if manifest.revision <= 0 or not manifest.sealed or not manifest.retrievable or not manifest.live:
        raise ManifestRejected("canonical manifest not ready")

def validate_profile(profile: ProcessingProfile) -> None:
    if not PROFILE_ID.fullmatch(profile.profile_id):
        raise MediaRejected("bounded static processing profile required")
    if profile.engine not in ALLOWED_ENGINES or profile.container not in ALLOWED_CONTAINERS:
        raise MediaRejected("unsupported processing profile")
    if profile.video_codec not in ALLOWED_VIDEO or profile.audio_codec not in ALLOWED_AUDIO:
        raise MediaRejected("unsupported codec profile")
    if profile.max_runtime_seconds <= 0 or profile.max_runtime_seconds > 6*60*60:
        raise MediaRejected("processing runtime exceeds bound")
    if profile.memory_max_bytes <= 0 or profile.memory_max_bytes > 8<<30:
        raise MediaRejected("processing memory exceeds bound")
    if profile.cpu_quota_percent <= 0 or profile.cpu_quota_percent > 400:
        raise MediaRejected("processing CPU exceeds bound")
    if profile.pids_limit <= 0 or profile.pids_limit > 256:
        raise MediaRejected("processing PID limit exceeds bound")

def validate_livestream(spec: LivestreamSpec, *, resolver) -> None:
    if not spec.session_id.strip() or not spec.stream_ref.strip() or not spec.controller_ref.strip():
        raise MediaRejected("complete livestream identity required")
    if len(spec.credential_ref.encode()) > MAX_CREDENTIAL_REF_BYTES:
        raise MediaRejected("credential reference too large")
    if not spec.credential_ref.strip():
        raise MediaRejected("opaque credential reference required")
    if spec.max_duration_seconds <= 0 or spec.max_duration_seconds > MAX_SESSION_SECONDS:
        raise MediaRejected("livestream duration exceeds bound")
    protocol=spec.protocol.lower()
    if protocol in {"whip","whep"}: schemes={"https"}
    elif protocol=="rtmp": schemes={"rtmps"}
    elif protocol=="srt": schemes={"srt"}
    elif protocol=="webrtc": schemes={"webrtc"}
    else: raise MediaRejected("unsupported livestream protocol")
    validate_endpoint(spec.endpoint, schemes, resolver=resolver)
