"""BNB-2.1 external signed identity token verifier.

420Identity remains issuer authority. This adapter never creates identity or Verify
attestations and cannot turn an asserted role into a verified host credential.
"""
import os
from datetime import datetime, timezone
import jwt
from fastapi import HTTPException

def verify_external_token(token: str) -> dict:
    issuer=os.environ.get("BNB_IDENTITY_ISSUER")
    audience=os.environ.get("BNB_IDENTITY_AUDIENCE")
    public_key=os.environ.get("BNB_IDENTITY_PUBLIC_KEY_PEM")
    if not all((issuer,audience,public_key)):
        raise HTTPException(503,"IDENTITY_PROVIDER_UNAVAILABLE")
    try:
        claims=jwt.decode(token,public_key,algorithms=["RS256"],issuer=issuer,
                          audience=audience,options={"require":["sub","iss","aud","exp","nbf","iat","jti"]},
                          leeway=5)
    except jwt.PyJWTError:
        raise HTTPException(401,"INVALID_IDENTITY_PROOF")
    if not isinstance(claims.get("sub"),str) or not claims["sub"] or len(claims["sub"])>256:
        raise HTTPException(401,"INVALID_IDENTITY_PROOF")
    now=datetime.now(timezone.utc).timestamp()
    # Do not accept malformed time claims, future-issued credentials, absent
    # session identifiers or identity assertions valid before issuance.
    if (any(type(claims.get(k)) not in (int,float) for k in ("iat","nbf","exp"))
        or not isinstance(claims.get("jti"),str)
        or not (1 <= len(claims["jti"]) <= 256)
        or any(ord(c)<33 or ord(c)>126 for c in claims["jti"])
        or claims["iat"]>now+5 or claims["nbf"]<claims["iat"]-5
        or claims["exp"]<=claims["iat"] or claims["exp"]-claims["iat"]>3600):
        raise HTTPException(401,"INVALID_IDENTITY_PROOF")
    # Caller-controlled 'host', 'verified', or 'admin' claims are NOT authoritative.
    return {"subject":claims["sub"],"issuer":issuer,"issuer_session_id":claims["jti"],"expires_at":datetime.fromtimestamp(claims["exp"],tz=timezone.utc)}
