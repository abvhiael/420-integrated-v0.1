"""Independent trust-boundary adapters for BnB.

No keys are minted in this service. External trusted gateways supply signed
JWTs only after a separately approved issuer/claim/recovery process.
"""
import os
import jwt
from fastapi import HTTPException

def verify_authority(token, prefix, purpose, subject=None):
    issuer=os.getenv(prefix+"_ISSUER")
    audience=os.getenv(prefix+"_AUDIENCE")
    key=os.getenv(prefix+"_PUBLIC_KEY_PEM")
    if not issuer or not audience or not key:
        raise HTTPException(503,"AUTHORITY_UNAVAILABLE")
    try:
        claims=jwt.decode(token,key,algorithms=["RS256"],issuer=issuer,audience=audience,
          options={"require":["iss","aud","sub","iat","nbf","exp","jti","purpose"]},leeway=5)
    except jwt.PyJWTError:
        raise HTTPException(401,"INVALID_AUTHORITY_PROOF")
    if claims.get("purpose") != purpose or not isinstance(claims.get("jti"),str):
        raise HTTPException(401,"INVALID_AUTHORITY_PURPOSE")
    if subject is not None and claims.get("sub")!=subject:
        raise HTTPException(403,"SUBJECT_MISMATCH")
    if claims["exp"]-claims["iat"]>300:
        raise HTTPException(401,"AUTHORITY_PROOF_TOO_OLD")
    return claims
