"""R02.2 identity boundary: no locally trusted issuer or wallet-based age inference."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

class Denied(PermissionError): pass

@dataclass(frozen=True)
class VerifiedPrincipal:
    issuer: str
    subject: str
    audience: str
    token_id: str
    expires_at: datetime

@dataclass(frozen=True)
class Session:
    tenant_id: str
    actor_id: str
    subject: str
    token_id: str
    expires_at: datetime
    revoked: bool
    wallet_consent_until: datetime | None

@dataclass(frozen=True)
class Grant:
    role: str
    resource: str
    expires_at: datetime
    revoked: bool

class TrustedIdentity(Protocol):
    def verify(self, signed_token: str, now: datetime) -> VerifiedPrincipal: ...
    def is_revoked(self, issuer: str, token_id: str) -> bool: ...

class AuthorizedSessionStore(Protocol):
    def resolve(self, subject: str, token_id: str, tenant_id: str) -> Session | None: ...
    def grants(self, tenant_id: str, actor_id: str) -> list[Grant]: ...

@dataclass(frozen=True)
class Permission:
    role: str
    action: str
    resource: str
    wallet_required: bool = False

ALLOWED_ACTIONS = {
    "CONSUMER": frozenset({"READ_OWN_ORDER", "CANCEL_OWN_ORDER"}),
    "COURIER": frozenset({"READ_ASSIGNED", "ACCEPT_OFFER", "PICKUP", "HANDOFF", "RETURN"}),
    "RETAILER": frozenset({"READ_STORE_ORDER", "READY_PICKUP", "ACCEPT_RETURN"}),
    "OPERATOR": frozenset({"READ_INCIDENT", "ESCALATE_INCIDENT"}),
}

def authorize(*, issuer: TrustedIdentity, store: AuthorizedSessionStore,
              signed_token: str, tenant_id: str, permission: Permission,
              now: datetime | None = None) -> Session:
    if now is None: now = datetime.now(timezone.utc)
    if now.tzinfo is None or not tenant_id or not signed_token:
        raise Denied("invalid authentication context")
    try:
        principal=issuer.verify(signed_token,now)
        if not principal.issuer or principal.audience!="doobr-api" or principal.expires_at<=now:
            raise Denied("invalid identity audience or expiry")
        if issuer.is_revoked(principal.issuer,principal.token_id):
            raise Denied("identity revoked")
        session=store.resolve(principal.subject,principal.token_id,tenant_id)
        if session is None or session.tenant_id!=tenant_id or session.subject!=principal.subject or session.token_id!=principal.token_id or session.revoked or session.expires_at<=now:
            raise Denied("session missing revoked or expired")
        if permission.wallet_required and (session.wallet_consent_until is None or session.wallet_consent_until<=now):
            raise Denied("wallet consent absent or expired")
        if not permission.resource or permission.action not in ALLOWED_ACTIONS.get(permission.role, ()):
            raise Denied("unspecified resource/action")
        grants=store.grants(tenant_id,session.actor_id)
        if not any(g.role==permission.role and g.resource==permission.resource and not g.revoked and g.expires_at>now for g in grants):
            raise Denied("role grant absent, expired, or revoked")
        return session
    except Denied:
        raise
    except Exception as exc:
        raise Denied("identity or authorization unavailable") from exc

def set_tenant_context(cursor, *, session: Session) -> None:
    """Only call on a trusted server-owned transaction AFTER authorize; DB users cannot select tenants."""
    if not session.tenant_id:
        raise Denied("missing authorized tenant")
    cursor.execute("SELECT set_config('doobr.tenant_id', %s, true)", (session.tenant_id,))
