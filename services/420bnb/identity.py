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
    if claims["exp"]-claims["iat"]>3600 or claims["iat"]>datetime.now(timezone.utc).timestamp()+5:
        raise HTTPException(401,"INVALID_IDENTITY_PROOF")
    # Caller-controlled 'host', 'verified', or 'admin' claims are NOT authoritative.
    return {"subject":claims["sub"],"issuer":issuer,"issuer_session_id":claims["jti"],"expires_at":datetime.fromtimestamp(claims["exp"],tz=timezone.utc)}
