"""DOOBTUBE-6 upload, processing, verified delivery and livestream integration."""
from __future__ import annotations
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Callable, Mapping
import json

from doobtube.api.persistence import Store
from .security import (
    ManifestRejected, MediaRejected, ProviderRejected, ScannerRejected,
    validate_endpoint, validate_livestream, validate_manifest, validate_profile,
    validate_upload, validate_upload_plan,
)
from .types import (
    LivestreamRecord, LivestreamSpec, MediaPort, PlaybackLocator, ProcessingProfile,
    ProcessingRequest, ProcessingResult, ProviderSnapshot, Scanner, StorageManifest,
    UploadInspection, UploadPlan,
)

class MediaIntegration:
    def __init__(
        self, store: Store, media: MediaPort, scanner: Scanner, *,
        resolver: Callable[[str], list[str]],
        now: Callable[[], datetime],
        max_reconnect_attempts: int=3,
        provider_max_age_seconds: int=300,
    ):
        if not store or not media or not scanner or not resolver:
            raise ValueError("media integration dependencies required")
        if max_reconnect_attempts < 1 or max_reconnect_attempts > 10:
            raise ValueError("bounded reconnect attempts required")
        self.store=store; self.media=media; self.scanner=scanner; self.resolver=resolver; self.now=now
        self.max_reconnect_attempts=max_reconnect_attempts
        self.provider_max_age_seconds=provider_max_age_seconds

    def prepare_upload(self, item: UploadInspection, idempotency_key: str) -> UploadPlan:
        validate_upload(item)
        result=self.scanner.scan(item)
        if result.verdict != "CLEAN" or not result.scanner_id.strip():
            raise ScannerRejected("media must pass qualified scanner before upload")
        if not idempotency_key.strip() or len(idempotency_key)>128:
            raise MediaRejected("bounded idempotency key required")
        plan=self.media.prepare_upload(item,idempotency_key)
        if plan.idempotency_key != idempotency_key:
            raise MediaRejected("Media changed upload idempotency identity")
        validate_upload_plan(plan,item,resolver=self.resolver)
        return plan

    def confirm_ready(self, plan: UploadPlan, manifest: StorageManifest) -> StorageManifest:
        validate_manifest(plan,manifest)
        return manifest

    def admit_playback(self, locator: PlaybackLocator, manifest: StorageManifest, plan: UploadPlan) -> str:
        validate_manifest(plan,manifest)
        if locator.asset_id != plan.asset_id or locator.manifest_revision != manifest.revision:
            raise ManifestRejected("stale playback locator/manifest revision")
        if locator.expires_at is not None and locator.expires_at <= self.now():
            raise ManifestRejected("expired playback locator")
        return validate_endpoint(locator.url,{"https"},resolver=self.resolver)

    def validate_provider(self, value: ProviderSnapshot, request: ProcessingRequest) -> None:
        if not value.active or not value.verified:
            raise ProviderRejected("inactive/unverified provider")
        if value.provider_id != request.expected_provider_id or value.operator_ref != request.expected_operator_ref:
            raise ProviderRejected("provider/operator identity mismatch")
        now_epoch=int(self.now().timestamp())
        if value.observed_at_epoch > now_epoch or now_epoch-value.observed_at_epoch > self.provider_max_age_seconds:
            raise ProviderRejected("stale/future provider evidence")

    def process(
        self, request: ProcessingRequest, profile: ProcessingProfile, provider: ProviderSnapshot
    ) -> ProcessingResult:
        validate_profile(profile)
        if request.profile_id != profile.profile_id:
            raise MediaRejected("processing profile substitution")
        if not request.media_job_id.strip() or not request.source_asset_id.strip() or not request.input_ref.strip():
            raise MediaRejected("complete processing request required")
        if request.deadline <= self.now():
            raise MediaRejected("processing deadline expired")
        self.validate_provider(provider,request)
        result=self.media.process(request)
        if (
            result.media_job_id != request.media_job_id or result.provider_id != provider.provider_id
            or result.profile_id != profile.profile_id or not result.output_asset_id.strip()
            or not result.output_ref.strip() or not result.verified
        ):
            raise ProviderRejected("processing result/provider evidence mismatch")
        if result.completed_at > request.deadline:
            raise ProviderRejected("processing exceeded canonical deadline")
        return result

    def create_livestream(self, spec: LivestreamSpec) -> LivestreamRecord:
        validate_livestream(spec,resolver=self.resolver)
        controller,retired=self.media.stream_controller(spec.stream_ref)
        if retired or controller.lower()!=spec.controller_ref.lower():
            raise MediaRejected("canonical stream controller mismatch")
        record=LivestreamRecord(spec,"created",False,0,"",self.now())
        self.store.put_media_session(record)
        return record

    def start_livestream(self, session_id: str, controller_ref: str, *, recovery: bool=False) -> LivestreamRecord:
        record=self.store.get_media_session(session_id)
        if record is None:
            raise MediaRejected("livestream session not found")
        if record.spec.controller_ref.lower()!=controller_ref.lower():
            raise MediaRejected("controller mismatch")
        controller,retired=self.media.stream_controller(record.spec.stream_ref)
        if retired or controller.lower()!=controller_ref.lower():
            raise MediaRejected("canonical controller authorization changed")
        if record.state=="active" and record.desired_live and not recovery:
            return record
        if record.reconnect_attempts>=self.max_reconnect_attempts and record.state=="failed":
            raise MediaRejected("livestream recovery exhausted")
        pending=LivestreamRecord(record.spec,"starting",True,record.reconnect_attempts,"",self.now())
        self.store.put_media_session(pending)
        try:
            state=self.media.livestream_start(record.spec)
        except Exception as exc:
            failed=LivestreamRecord(record.spec,"failed",True,record.reconnect_attempts+1,str(exc)[:500],self.now())
            self.store.put_media_session(failed)
            raise
        if state!="active":
            failed=LivestreamRecord(record.spec,"failed",True,record.reconnect_attempts+1,"unexpected Media state",self.now())
            self.store.put_media_session(failed)
            raise MediaRejected("Media did not confirm active livestream")
        active=LivestreamRecord(record.spec,"active",True,0,"",self.now())
        self.store.put_media_session(active)
        return active

    def stop_livestream(self, session_id: str, controller_ref: str) -> LivestreamRecord:
        record=self.store.get_media_session(session_id)
        if record is None or record.spec.controller_ref.lower()!=controller_ref.lower():
            raise MediaRejected("livestream session/controller mismatch")
        controller,_retired=self.media.stream_controller(record.spec.stream_ref)
        if controller.lower()!=controller_ref.lower():
            raise MediaRejected("canonical controller authorization changed")
        state=self.media.livestream_stop(session_id,controller_ref)
        if state!="closed":
            failed=LivestreamRecord(record.spec,"failed",False,record.reconnect_attempts,"unexpected Media stop state",self.now())
            self.store.put_media_session(failed)
            raise MediaRejected("Media did not confirm closed livestream")
        closed=LivestreamRecord(record.spec,"closed",False,record.reconnect_attempts,"",self.now())
        self.store.put_media_session(closed)
        return closed

    def recover_livestreams(self) -> list[LivestreamRecord]:
        out=[]
        for record in self.store.list_media_sessions():
            if not record.desired_live:
                continue
            controller,retired=self.media.stream_controller(record.spec.stream_ref)
            if retired or controller.lower()!=record.spec.controller_ref.lower():
                failed=LivestreamRecord(record.spec,"failed",False,record.reconnect_attempts,"authorization changed",self.now())
                self.store.put_media_session(failed); out.append(failed); continue
            if record.reconnect_attempts>=self.max_reconnect_attempts:
                failed=LivestreamRecord(record.spec,"failed",False,record.reconnect_attempts,"recovery exhausted",self.now())
                self.store.put_media_session(failed); out.append(failed); continue
            try:
                out.append(self.start_livestream(record.spec.session_id,record.spec.controller_ref,recovery=True))
            except Exception:
                latest=self.store.get_media_session(record.spec.session_id)
                if latest is not None: out.append(latest)
        return out
