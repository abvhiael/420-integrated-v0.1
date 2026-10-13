"""R04.5 canonical Wallet consent boundary; no local wallet signature authority."""
from dataclasses import dataclass
from datetime import datetime,timezone
from .auth import Denied,authorize,Permission

@dataclass(frozen=True)
class WalletConsent:
    issuer:str
    tenant_id:str
    actor_id:str
    session_token_id:str
    consent_id:str
    audience:str
    action:str
    resource:str
    nonce:str
    issued_at:datetime
    expires_at:datetime
    revoked:bool

def authorize_wallet_action(*,identity,session_store,signed_token,tenant_id,
        action,resource,signed_consent,wallet,nonces,now=None):
    now=now or datetime.now(timezone.utc)
    if not isinstance(now,datetime) or now.tzinfo is None or not signed_consent or not action or not resource:
        raise Denied("invalid wallet authorization context")
    # Identity and session grants are independently verified on every request.
    session=authorize(issuer=identity,store=session_store,signed_token=signed_token,
        tenant_id=tenant_id,permission=Permission("CONSUMER",action,resource,wallet_required=True),now=now)
    try:
        consent=wallet.verify_consent(signed_consent=signed_consent,at=now)
        if not isinstance(consent,WalletConsent) or (
            not consent.issuer or consent.audience!="doobr-api" or consent.tenant_id!=tenant_id
            or consent.actor_id!=session.actor_id or consent.session_token_id!=session.token_id
            or consent.action!=action or consent.resource!=resource
            or not consent.consent_id or not consent.nonce or consent.revoked is not False
            or not isinstance(consent.issued_at,datetime) or not isinstance(consent.expires_at,datetime)
            or consent.issued_at.tzinfo is None or consent.expires_at.tzinfo is None
            or not consent.issued_at<=now<consent.expires_at
            or consent.expires_at>session.expires_at
            or consent.expires_at>session.wallet_consent_until):
            raise Denied("wallet consent invalid revoked or out of scope")
        # Revalidate current canonical withdrawal separately from signed envelope.
        if wallet.is_revoked(issuer=consent.issuer,consent_id=consent.consent_id,at=now) is not False:
            raise Denied("wallet consent withdrawn")
        # Must be durable atomic unique insert keyed by tenant, wallet issuer, consent ID, nonce.
        # No action executes until confirmed new insertion; no fallback on outage.
        inserted=nonces.record_once(tenant_id=tenant_id,issuer=consent.issuer,
             consent_id=consent.consent_id,nonce=consent.nonce,at=now)
        if inserted is not True:raise Denied("wallet consent replay or ledger unavailable")
        return session
    except Denied:raise
    except Exception as exc:raise Denied("canonical wallet verifier or replay ledger unavailable") from exc
