"""DOOBTUBE-5 backend/API/indexing/service control plane."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import re
import uuid
from typing import Any, Callable, Iterable, Mapping

from doobtube.api.errors import (
    APIError, CONFLICT, DEPENDENCY_MISMATCH, FORBIDDEN, IDEMPOTENCY_CONFLICT,
    INVALID_REQUEST, NOT_FOUND, UNAUTHORIZED, UNAVAILABLE,
)
from doobtube.api.persistence import Store
from doobtube.security import AbuseGuard, SecurityDenied, redact_sensitive_text
from doobtube.api.types import (
    API_VERSION, MAX_IDEMPOTENCY_KEY, MAX_PAGE_LIMIT, AuthContext, ProjectionEvent,
    Request, Response, decode_cursor, encode_cursor, rfc3339, utc_now,
)


@dataclass(frozen=True)
class RuntimeConfig:
    chain_id: int
    network: str
    database_path: str
    registry_snapshot_max_age_seconds: int = 300
    max_job_attempts: int = 3
    retry_base_seconds: int = 2
    secret_provider_ref: str = ""
    raw_secret: str = ""

    def validate(self) -> None:
        if self.chain_id <= 0 or not self.network:
            raise ValueError("chain/network required")
        if self.max_job_attempts < 1 or self.max_job_attempts > 10:
            raise ValueError("bounded max_job_attempts required")
        if self.retry_base_seconds < 1 or self.retry_base_seconds > 300:
            raise ValueError("bounded retry base required")
        if self.raw_secret:
            raise ValueError("raw secrets may not be stored in DoobTube runtime config")
        if self.secret_provider_ref and len(self.secret_provider_ref) > 256:
            raise ValueError("bounded secret provider reference required")


class Metrics:
    def __init__(self):
        self._counters: dict[str, int] = {}

    def inc(self, name: str) -> None:
        self._counters[name] = self._counters.get(name, 0) + 1

    def snapshot(self) -> dict[str, int]:
        return dict(sorted(self._counters.items()))


class Backend:
    def __init__(
        self,
        config: RuntimeConfig,
        *,
        store: Store | None = None,
        dependency_probe: Callable[[], Mapping[str, bool]] | None = None,
        now: Callable[[], datetime] = utc_now,
        abuse_guard: AbuseGuard | None = None,
    ):
        config.validate()
        self.config = config
        self.store = store or Store(config.database_path)
        self.dependency_probe = dependency_probe or (lambda: {"420Media": True, "420Registry": True})
        self.now = now
        self.metrics = Metrics()
        self.abuse = abuse_guard or AbuseGuard(now=now)
        self.started_at = self.now()

    def close(self) -> None:
        self.store.close()

    def _headers(self) -> dict[str, str]:
        return {"X-DoobTube-API-Version": API_VERSION, "Content-Type": "application/json"}

    def _ok(self, status: int, data: Mapping[str, Any]) -> Response:
        return Response(status, {"version": API_VERSION, "data": data}, self._headers())

    def _error(self, err: APIError) -> Response:
        self.metrics.inc("api_errors_total")
        return Response(
            err.status,
            {"version": API_VERSION, "error": {"code": err.code, "message": err.message}},
            self._headers(),
        )

    def handle(self, request: Request) -> Response:
        self.metrics.inc("api_requests_total")
        try:
            if not request.path.startswith("/v1/"):
                raise APIError(NOT_FOUND, "route not found", 404)
            if request.path == "/v1/health" and request.method == "GET":
                return self.health()
            if request.path == "/v1/readiness" and request.method == "GET":
                return self.readiness()
            if request.path == "/v1/feed" and request.method == "GET":
                return self.feed(request)
            if request.path == "/v1/preferences" and request.method == "GET":
                return self.get_preferences(request)
            if request.path == "/v1/preferences" and request.method == "PUT":
                return self.put_preferences(request)
            if request.path == "/v1/control/rebuild" and request.method == "POST":
                return self.request_rebuild(request)
            if request.path == "/v1/metrics" and request.method == "GET":
                return self.metrics_endpoint(request)
            raise APIError(NOT_FOUND, "route not found", 404)
        except APIError as err:
            return self._error(err)
        except SecurityDenied as err:
            return self._error(APIError('RATE_LIMITED', str(err), 429))
        except (ValueError, TypeError, json.JSONDecodeError):
            return self._error(APIError(INVALID_REQUEST, "invalid request", 400))

    def health(self) -> Response:
        return self._ok(200, {
            "status": "ok",
            "started_at": rfc3339(self.started_at),
            "now": rfc3339(self.now()),
        })

    def readiness(self) -> Response:
        deps = dict(self.dependency_probe())
        required = {"420Media", "420Registry"}
        ready = all(deps.get(name, False) for name in required)
        data = {
            "status": "ready" if ready else "not_ready",
            "chain_id": self.config.chain_id,
            "network": self.config.network,
            "dependencies": deps,
            "schema_version": 1,
        }
        return self._ok(200 if ready else 503, data)

    def _auth(self, request: Request, *, capability: str | None = None) -> AuthContext:
        auth = request.auth
        if auth is None or auth.anonymous:
            raise APIError(UNAUTHORIZED, "wallet authorization required", 401)
        if auth.chain_id != self.config.chain_id or auth.network != self.config.network:
            raise APIError(DEPENDENCY_MISMATCH, "wallet chain/network mismatch", 409)
        if capability and capability not in auth.capabilities:
            raise APIError(FORBIDDEN, "required capability unavailable", 403)
        return auth

    def _idempotency_key(self, request: Request) -> str:
        key = request.headers.get("Idempotency-Key", "").strip()
        if not key or len(key) > MAX_IDEMPOTENCY_KEY or not re.fullmatch(r"[A-Za-z0-9._:-]+", key):
            raise APIError(INVALID_REQUEST, "valid Idempotency-Key required", 400)
        return key

    def _idempotent(
        self,
        request: Request,
        *,
        actor: str,
        operation: str,
        effect: Callable[[], Mapping[str, Any]],
    ) -> Mapping[str, Any]:
        key = self._idempotency_key(request)
        request_hash = self.store.request_hash(request.body)
        prior = self.store.get_idempotency(key, actor, operation)
        if prior:
            if prior.request_hash != request_hash:
                raise APIError(IDEMPOTENCY_CONFLICT, "idempotency key reused with different payload", 409)
            self.metrics.inc("idempotency_replays_total")
            return json.loads(prior.response_json)
        with self.store.tx():
            # re-read inside write transaction
            prior = self.store.get_idempotency(key, actor, operation)
            if prior:
                if prior.request_hash != request_hash:
                    raise APIError(IDEMPOTENCY_CONFLICT, "idempotency key reused with different payload", 409)
                return json.loads(prior.response_json)
            response = dict(effect())
            self.store.put_idempotency(
                key, actor, operation, request_hash, response, rfc3339(self.now())
            )
            return response

    def put_preferences(self, request: Request) -> Response:
        auth = self._auth(request, capability="doobtube.preferences")
        allowed = {"autoplay", "reduced_motion", "muted_creators"}
        if any(k not in allowed for k in request.body):
            raise APIError(INVALID_REQUEST, "unknown preference field", 400)
        if "muted_creators" in request.body:
            value = request.body["muted_creators"]
            if not isinstance(value, list) or len(value) > 500 or any(not isinstance(x, str) or len(x) > 160 for x in value):
                raise APIError(INVALID_REQUEST, "invalid muted_creators", 400)

        def effect():
            self.abuse.require(auth.wallet or "", "preferences.write")
            payload = dict(request.body)
            self.store.put_preferences(auth.wallet or "", payload, rfc3339(self.now()))
            return {"preferences": payload, "updated_at": rfc3339(self.now())}

        data = self._idempotent(request, actor=auth.wallet or "", operation="preferences.put", effect=effect)
        return self._ok(200, data)

    def get_preferences(self, request: Request) -> Response:
        auth = self._auth(request)
        payload = self.store.get_preferences(auth.wallet or "") or {}
        return self._ok(200, {"preferences": payload})

    def feed(self, request: Request) -> Response:
        try:
            limit = int(request.query.get("limit", "20"))
        except ValueError:
            raise APIError(INVALID_REQUEST, "invalid limit", 400)
        if limit < 1 or limit > MAX_PAGE_LIMIT:
            raise APIError(INVALID_REQUEST, f"limit must be 1..{MAX_PAGE_LIMIT}", 400)
        try:
            offset = decode_cursor(request.query.get("cursor", ""))
        except Exception:
            raise APIError(INVALID_REQUEST, "invalid cursor", 400)
        rows = self.store.feed_page(offset, limit + 1)
        more = len(rows) > limit
        rows = rows[:limit]
        items = [
            {
                "media_asset_id": row["media_asset_id"],
                "title": row["title"],
                "creator_ref": row["creator_ref"],
                "block_height": row["block_height"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]
        return self._ok(200, {
            "items": items,
            "next_cursor": encode_cursor(offset + limit) if more else "",
        })

    def request_rebuild(self, request: Request) -> Response:
        auth = self._auth(request, capability="doobtube.operator.rebuild")

        def effect():
            self.abuse.require(auth.wallet or "", "control.rebuild")
            job_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"doobtube:rebuild:{auth.wallet}:{self._idempotency_key(request)}"))
            now = rfc3339(self.now())
            self.store.enqueue_job({
                "job_id": job_id,
                "kind": "projection_rebuild",
                "payload": {"requested_by": auth.wallet},
                "state": "PENDING",
                "attempts": 0,
                "max_attempts": self.config.max_job_attempts,
                "next_attempt_at": now,
                "last_error": "",
                "created_at": now,
                "updated_at": now,
            })
            return {"job_id": job_id, "state": "PENDING"}

        data = self._idempotent(request, actor=auth.wallet or "", operation="control.rebuild", effect=effect)
        return self._ok(202, data)

    def metrics_endpoint(self, request: Request) -> Response:
        auth = self._auth(request, capability="doobtube.operator.metrics")
        self.abuse.require(auth.wallet or "", "operator.metrics")
        return self._ok(200, {"counters": self.metrics.snapshot()})

    def apply_projection(self, event: ProjectionEvent) -> None:
        if event.block_height < 0 or not event.block_hash:
            raise APIError(INVALID_REQUEST, "invalid projection event", 400)
        if event.finalized_height > event.block_height:
            raise APIError(INVALID_REQUEST, "finalized height cannot exceed event height", 400)

        with self.store.tx():
            existing = self.store.block_at(event.block_height)
            if existing:
                if existing["block_hash"] == event.block_hash:
                    return
                if bool(existing["finalized"]):
                    raise APIError(CONFLICT, "finalized projection history conflict", 409)
                ancestor_height = event.block_height - 1
                if ancestor_height < self.store.finalized_height():
                    raise APIError(CONFLICT, "reorg crosses finalized boundary", 409)
                self.store.rollback_after(ancestor_height)

            tip = self.store.tip()
            if tip:
                if event.block_height != tip["height"] + 1:
                    raise APIError(CONFLICT, "non-contiguous projection event", 409)
                if event.parent_hash != tip["block_hash"]:
                    if bool(tip["finalized"]):
                        raise APIError(CONFLICT, "parent mismatch at finalized tip", 409)
                    raise APIError(CONFLICT, "projection parent mismatch requires explicit rollback event", 409)
            elif event.block_height != 0:
                raise APIError(CONFLICT, "projection must start from genesis/rebuild origin", 409)

            self.store.put_projection_event(event, rfc3339(event.observed_at))
            self.store.mark_finalized_through(event.finalized_height)

    def rebuild_projection(self, events: Iterable[ProjectionEvent]) -> int:
        ordered = list(events)
        if any(ordered[i].block_height >= ordered[i+1].block_height for i in range(len(ordered)-1)):
            raise APIError(INVALID_REQUEST, "rebuild events must be strictly ordered", 400)
        with self.store.tx():
            self.store.clear_projection()
        count = 0
        for event in ordered:
            self.apply_projection(event)
            count += 1
        self.metrics.inc("projection_rebuilds_total")
        return count

    def run_due_jobs(self, handlers: Mapping[str, Callable[[Mapping[str, Any]], None]]) -> int:
        now = self.now()
        rows = self.store.due_jobs(rfc3339(now))
        processed = 0
        for row in rows:
            processed += 1
            attempts = int(row["attempts"]) + 1
            handler = handlers.get(row["kind"])
            try:
                if handler is None:
                    raise RuntimeError("no handler registered")
                handler(json.loads(row["payload_json"]))
            except Exception as exc:
                if attempts >= int(row["max_attempts"]):
                    state = "FAILED"
                    next_at = now
                else:
                    state = "RETRY"
                    delay = min(self.config.retry_base_seconds * (2 ** (attempts - 1)), 300)
                    next_at = now + timedelta(seconds=delay)
                self.store.save_job_state(
                    row["job_id"], state, attempts, rfc3339(next_at), redact_sensitive_text(exc), rfc3339(now)
                )
                self.store.db.commit()
                self.metrics.inc("jobs_failed_total")
            else:
                self.store.save_job_state(
                    row["job_id"], "DONE", attempts, rfc3339(now), "", rfc3339(now)
                )
                self.store.db.commit()
                self.metrics.inc("jobs_completed_total")
        return processed
