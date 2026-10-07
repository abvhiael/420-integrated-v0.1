"""DOOBTUBE-6 media integration types."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

MAX_UPLOAD_BYTES = 8 << 30
MAX_SESSION_SECONDS = 24 * 60 * 60
MAX_ENDPOINT_BYTES = 4096
MAX_CREDENTIAL_REF_BYTES = 256

@dataclass(frozen=True)
class UploadInspection:
    asset_id: str
    mime_type: str
    size_bytes: int
    sha256: str
    source_ref: str

@dataclass(frozen=True)
class ScanResult:
    verdict: str
    scanner_id: str
    reason: str = ""

@dataclass(frozen=True)
class UploadPlan:
    asset_id: str
    object_id: str
    manifest_id: str
    shard_index: int
    shard_root: str
    size_bytes: int
    commitment_id: str
    endpoint: str
    upload_id: str
    idempotency_key: str

@dataclass(frozen=True)
class StorageManifest:
    object_id: str
    manifest_id: str
    shard_index: int
    shard_root: str
    size_bytes: int
    commitment_id: str
    sealed: bool
    retrievable: bool
    live: bool
    revision: int

@dataclass(frozen=True)
class ProcessingProfile:
    profile_id: str
    engine: str
    container: str
    video_codec: str
    audio_codec: str
    max_runtime_seconds: int
    memory_max_bytes: int
    cpu_quota_percent: int
    pids_limit: int

@dataclass(frozen=True)
class ProviderSnapshot:
    provider_id: str
    operator_ref: str
    active: bool
    verified: bool
    observed_at_epoch: int

@dataclass(frozen=True)
class ProcessingRequest:
    media_job_id: str
    source_asset_id: str
    input_ref: str
    profile_id: str
    expected_provider_id: str
    expected_operator_ref: str
    deadline: datetime

@dataclass(frozen=True)
class ProcessingResult:
    media_job_id: str
    output_asset_id: str
    output_ref: str
    provider_id: str
    profile_id: str
    verified: bool
    completed_at: datetime

@dataclass(frozen=True)
class PlaybackLocator:
    asset_id: str
    url: str
    manifest_revision: int
    expires_at: datetime | None = None

@dataclass(frozen=True)
class LivestreamSpec:
    session_id: str
    stream_ref: str
    controller_ref: str
    protocol: str
    direction: str
    endpoint: str
    credential_ref: str
    max_duration_seconds: int

@dataclass(frozen=True)
class LivestreamRecord:
    spec: LivestreamSpec
    state: str
    desired_live: bool
    reconnect_attempts: int
    last_error: str
    updated_at: datetime

class Scanner(Protocol):
    def scan(self, item: UploadInspection) -> ScanResult: ...

class MediaPort(Protocol):
    def prepare_upload(self, item: UploadInspection, idempotency_key: str) -> UploadPlan: ...
    def process(self, request: ProcessingRequest) -> ProcessingResult: ...
    def livestream_start(self, spec: LivestreamSpec) -> str: ...
    def livestream_stop(self, session_id: str, controller_ref: str) -> str: ...
    def stream_controller(self, stream_ref: str) -> tuple[str, bool]: ...
