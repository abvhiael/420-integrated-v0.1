"""PB-14 backend/API hardening.

This module is an authenticated transport/edge boundary only. It validates transport,
session, replay, rate-limit and payload policy before delegating to an injected
application gateway. It never decides PuffBuddies relationships, consent, safety,
eligibility, lifecycle, visibility or premium authority.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import re
import secrets
from typing import Any, Mapping, Protocol

API_BASE = "/api/puffbuddies/v1"
JSON_LIMIT = 64 * 1024
MEDIA_LIMIT = 11 * 1024 * 1024
TOKEN_LIMIT = 4096
IDEMPOTENCY_RE = re.compile(r"^[A-Za-z0-9._:-]{16,128}$")
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,96}$")


class ApiDenied(PermissionError):
    pass


class DependencyUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class RouteSpec:
    route_id: str
    method: str
    path: str
    mutating: bool = False
    body_limit: int = 0
    content_types: tuple[str, ...] = ()


def _route(route_id: str, method: str, path: str, *, mutating: bool = False,
           body_limit: int = 0, content_types: tuple[str, ...] = ()) -> RouteSpec:
    return RouteSpec(route_id, method, path, mutating, body_limit, content_types)


_ROUTE_LIST = (
    _route("session", "GET", "/session"),
    _route("eligibility", "GET", "/eligibility"),
    _route("profile_get", "GET", "/profile"),
    _route("profile_put", "PUT", "/profile", mutating=True, body_limit=JSON_LIMIT,
           content_types=("application/json",)),
    _route("profile_media", "POST", "/profile/media", mutating=True, body_limit=MEDIA_LIMIT,
           content_types=("application/json", "multipart/form-data")),
    _route("discovery", "GET", "/discovery"),
    _route("relationship_action", "POST", "/relationships/action", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("matches", "GET", "/matches"),
    _route("messenger_entry", "POST", "/messenger/entry", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("notifications", "GET", "/notifications"),
    _route("notification_device_post", "POST", "/notifications/device", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("notification_device_delete", "DELETE", "/notifications/device", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("safety_action", "POST", "/safety/action", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("visibility", "PUT", "/profile/visibility", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("lifecycle", "POST", "/lifecycle", mutating=True,
           body_limit=JSON_LIMIT, content_types=("application/json",)),
    _route("deletion_status", "GET", "/deletion/status"),
    _route("verification", "GET", "/verification"),
    _route("premium", "GET", "/premium/entitlements"),
)
ROUTES: Mapping[tuple[str, str], RouteSpec] = {(r.method, r.path): r for r in _ROUTE_LIST}


@dataclass(frozen=True)
class SessionContext:
    session_ref: str
    subject_ref: str
    expires_at_epoch: int
    authority_generation: int
    revoked: bool = False

    def __post_init__(self) -> None:
        if not self.session_ref or len(self.session_ref) > 192:
            raise ValueError("bounded opaque session reference required")
        if not self.subject_ref or len(self.subject_ref) > 192:
            raise ValueError("bounded opaque subject reference required")
        if self.expires_at_epoch < 0 or self.authority_generation < 0:
            raise ValueError("invalid session freshness")


@dataclass(frozen=True)
class ApiRequest:
    method: str
    path: str
    headers: Mapping[str, str]
    body: bytes = b""
    scheme: str = "https"
    host: str = ""
    now_epoch: int = 0


@dataclass(frozen=True)
class GatewayResult:
    status: int
    payload: Mapping[str, Any] | None
    authority_generation: int

    def __post_init__(self) -> None:
        if self.status not in {200, 201, 202, 204}:
            raise ValueError("gateway success status required")
        if self.authority_generation < 0:
            raise ValueError("authority generation must be nonnegative")
        if self.status == 204 and self.payload is not None:
            raise ValueError("204 response cannot carry payload")


@dataclass(frozen=True)
class ApiResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


class SessionAuthenticator(Protocol):
    def authenticate(self, bearer_token: str, *, now_epoch: int) -> SessionContext | None: ...


class ApplicationGateway(Protocol):
    def dispatch(self, route_id: str, *, session: SessionContext,
                 payload: Mapping[str, Any] | bytes | None,
                 request_id: str) -> GatewayResult: ...


class RateLimiter(Protocol):
    def allow(self, *, session_ref: str, route_id: str, now_epoch: int) -> bool: ...


class ReplayGuard(Protocol):
    def reserve(self, *, session_ref: str, key: str, fingerprint: str,
                now_epoch: int) -> bool: ...


class AuditSink(Protocol):
    def record(self, *, request_id: str, route_id: str, status: int) -> None: ...


def _headers(values: Mapping[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in values.items():
        k = str(key).strip().lower()
        v = str(value).strip()
        if "\r" in v or "\n" in v:
            raise ApiDenied("invalid header")
        if k in out:
            raise ApiDenied("duplicate header")
        out[k] = v
    return out


def _request_id(headers: Mapping[str, str]) -> str:
    candidate = headers.get("x-request-id", "")
    if candidate and REQUEST_ID_RE.fullmatch(candidate):
        return candidate
    return "pb-" + secrets.token_hex(16)


def _json_object(raw: bytes) -> Mapping[str, Any]:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ApiDenied("invalid json encoding") from exc

    def no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ApiDenied("duplicate json key")
            result[key] = value
        return result

    try:
        value = json.loads(text, object_pairs_hook=no_duplicates)
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise ApiDenied("invalid json") from exc
    if not isinstance(value, dict):
        raise ApiDenied("json object required")
    return value


def _content_type(headers: Mapping[str, str]) -> str:
    value = headers.get("content-type", "").lower()
    return value.split(";", 1)[0].strip()


def _security_headers(request_id: str) -> dict[str, str]:
    return {
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Request-Id": request_id,
    }


class ApiTransport:
    """Fail-closed PB-14 transport around canonical PuffBuddies application handlers."""

    def __init__(self, *, authenticator: SessionAuthenticator, gateway: ApplicationGateway,
                 rate_limiter: RateLimiter, replay_guard: ReplayGuard, audit_sink: AuditSink,
                 allowed_hosts: frozenset[str], require_https: bool = True) -> None:
        if not allowed_hosts or any(not h or "/" in h for h in allowed_hosts):
            raise ValueError("explicit allowed API hosts required")
        self.authenticator = authenticator
        self.gateway = gateway
        self.rate_limiter = rate_limiter
        self.replay_guard = replay_guard
        self.audit_sink = audit_sink
        self.allowed_hosts = allowed_hosts
        self.require_https = require_https

    def _response(self, status: int, request_id: str, route_id: str,
                  payload: Mapping[str, Any] | None = None) -> ApiResponse:
        if payload is None:
            payload = {"error": "request_denied", "requestId": request_id}
        body = b"" if status == 204 else json.dumps(
            payload, separators=(",", ":"), sort_keys=True
        ).encode("utf-8")
        try:
            self.audit_sink.record(request_id=request_id, route_id=route_id, status=status)
        except Exception:
            # Audit delivery must not turn a denial into authority or leak request bodies.
            if status < 400:
                status = 503
                body = json.dumps(
                    {"error": "request_denied", "requestId": request_id},
                    separators=(",", ":"), sort_keys=True
                ).encode("utf-8")
        return ApiResponse(status, _security_headers(request_id), body)

    def handle(self, request: ApiRequest) -> ApiResponse:
        request_id = "pb-" + secrets.token_hex(16)
        route_id = "unresolved"
        try:
            headers = _headers(request.headers)
            request_id = _request_id(headers)
            method = request.method.upper().strip()
            if self.require_https and request.scheme.lower() != "https":
                raise ApiDenied("https required")
            if request.host not in self.allowed_hosts:
                raise ApiDenied("host denied")
            if "?" in request.path or "#" in request.path or not request.path.startswith(API_BASE + "/"):
                raise ApiDenied("canonical API path required")
            relative = request.path[len(API_BASE):]
            route = ROUTES.get((method, relative))
            if route is None:
                known_path = any(r.path == relative for r in _ROUTE_LIST)
                status = 405 if known_path else 404
                return self._response(status, request_id, route_id)
            route_id = route.route_id

            if request.now_epoch < 0:
                raise ApiDenied("invalid clock")
            if len(request.body) > route.body_limit:
                return self._response(413, request_id, route_id)
            declared = headers.get("content-length")
            if declared:
                try:
                    if int(declared) != len(request.body):
                        raise ApiDenied("content length mismatch")
                except ValueError as exc:
                    raise ApiDenied("invalid content length") from exc
            if route.body_limit == 0 and request.body:
                raise ApiDenied("request body not permitted")
            if route.body_limit > 0:
                ctype = _content_type(headers)
                if ctype not in route.content_types:
                    return self._response(415, request_id, route_id)
                if ctype == "multipart/form-data" and "boundary=" not in headers.get("content-type", "").lower():
                    raise ApiDenied("multipart boundary required")

            origin = headers.get("origin")
            if headers.get("sec-fetch-site", "").lower() == "cross-site":
                raise ApiDenied("cross-site request denied")
            if origin and origin != f"https://{request.host}":
                raise ApiDenied("origin mismatch")

            auth = headers.get("authorization", "")
            if not auth.startswith("Bearer "):
                return self._response(401, request_id, route_id)
            token = auth[7:]
            if not token or len(token) > TOKEN_LIMIT or any(ch.isspace() for ch in token):
                return self._response(401, request_id, route_id)
            try:
                session = self.authenticator.authenticate(token, now_epoch=request.now_epoch)
            except Exception as exc:
                raise DependencyUnavailable("session authority unavailable") from exc
            if session is None or session.revoked or request.now_epoch >= session.expires_at_epoch:
                return self._response(401, request_id, route_id)

            try:
                if not self.rate_limiter.allow(
                    session_ref=session.session_ref, route_id=route_id, now_epoch=request.now_epoch
                ):
                    return self._response(429, request_id, route_id)
            except Exception as exc:
                raise DependencyUnavailable("rate limiter unavailable") from exc

            payload: Mapping[str, Any] | bytes | None = None
            if request.body:
                ctype = _content_type(headers)
                payload = _json_object(request.body) if ctype == "application/json" else request.body

            if route.mutating:
                key = headers.get("idempotency-key", "")
                if not IDEMPOTENCY_RE.fullmatch(key):
                    return self._response(400, request_id, route_id)
                fingerprint = sha256(
                    method.encode("ascii") + b"\0" + relative.encode("utf-8") + b"\0" + request.body
                ).hexdigest()
                try:
                    fresh = self.replay_guard.reserve(
                        session_ref=session.session_ref, key=key, fingerprint=fingerprint,
                        now_epoch=request.now_epoch
                    )
                except Exception as exc:
                    raise DependencyUnavailable("replay guard unavailable") from exc
                if not fresh:
                    return self._response(409, request_id, route_id)

            try:
                result = self.gateway.dispatch(
                    route_id, session=session, payload=payload, request_id=request_id
                )
            except ApiDenied:
                return self._response(403, request_id, route_id)
            except Exception as exc:
                raise DependencyUnavailable("application gateway unavailable") from exc

            if result.authority_generation < session.authority_generation:
                return self._response(409, request_id, route_id)
            if result.status == 204:
                return self._response(204, request_id, route_id, {})
            response_payload = dict(result.payload or {})
            response_payload["authorityGeneration"] = result.authority_generation
            response_payload["requestId"] = request_id
            return self._response(result.status, request_id, route_id, response_payload)

        except ApiDenied:
            return self._response(403, request_id, route_id)
        except DependencyUnavailable:
            return self._response(503, request_id, route_id)
