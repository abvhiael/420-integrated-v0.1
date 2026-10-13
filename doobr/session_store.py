"""Postgres implementation of the R02.2 AuthorizedSessionStore contract.

Use only from a trusted API process with an unprivileged dedicated non-owner DB role.
Every query runs in an isolated transaction with tenant RLS context. No client SQL.
"""
import hashlib
from uuid import UUID
from .auth import Session, Grant, Denied

class PostgresSessionStore:
    def __init__(self, connect):
        self.connect = connect

    def _run(self, tenant_id, query, params):
        try:
            normalized = str(UUID(tenant_id))
            with self.connect() as db:
                with db.transaction():
                    with db.cursor() as cur:
                        cur.execute("SELECT set_config('doobr.tenant_id', %s, true)", (normalized,))
                        cur.execute(query, params)
                        return cur.fetchall()
        except Exception as error:
            raise Denied("authoritative session database unavailable") from error

    def resolve(self, subject, token_id, tenant_id):
        if not subject or not token_id:
            return None
        digest = hashlib.sha256(token_id.encode("utf-8")).digest()
        rows = self._run(tenant_id, """
            SELECT s.actor_id, s.issuer_ref, s.expires_at, s.revoked_at,
                   s.wallet_consent, s.wallet_consent_expires_at, a.identity_ref
              FROM doobr_private.identity_sessions s
              JOIN doobr_private.actors a
                ON a.tenant_id=s.tenant_id AND a.actor_id=s.actor_id
             WHERE s.tenant_id=%s AND s.token_jti_digest=%s
               AND s.audience='doobr-api' AND a.state='ACTIVE'
        """, (tenant_id,digest))
        if len(rows)!=1:
            return None
        actor_id,issuer,expires,revoked,consent,consent_until,identity_ref=rows[0]
        if identity_ref != issuer+":"+subject:
            return None
        return Session(tenant_id,str(actor_id),subject,issuer,token_id,
                       expires,revoked is not None,consent_until if consent else None)

    def grants(self, tenant_id, actor_id):
        rows=self._run(tenant_id, """
          SELECT role, resource_ref, expires_at, revoked_at
            FROM doobr_private.role_grants
           WHERE tenant_id=%s AND actor_id=%s
        """,(tenant_id,actor_id))
        return [Grant(role,resource,expiry,revoked is not None)
                for role,resource,expiry,revoked in rows]
