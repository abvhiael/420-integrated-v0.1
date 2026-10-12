"""Private staging identity adapter: trust roots injected from controlled secret configuration.

No client-supplied verified flags. Signature, key rotation, challenge, revocation
and device trust must be checked by independent cryptographic verifiers.
"""
from datetime import datetime,timezone
from .auth import Denied
from .mobile_offline import identifier

class StagingIdentity:
 def __init__(self,*,jwt_verifier,device_verifier,revocation,issuer,audience):
  if not issuer or not audience:raise Denied("identity configuration missing")
  self.jwt_verifier=jwt_verifier
  self.device_verifier=device_verifier
  self.revocation=revocation
  self.issuer=issuer
  self.audience=audience

 def verify_replay(self,*,token,tenant_id,device_id,at):
  if not isinstance(at,datetime) or at.tzinfo is None:return False
  try:
   tenant_id,device_id=identifier(tenant_id),identifier(device_id)
   # JWT verifier owns signature validation, JWKS key rotation, allowed algorithms,
   # issuer/audience, clock skew, expiry and not-before. Never decode-only.
   claims=self.jwt_verifier.verify(token=token,issuer=self.issuer,audience=self.audience,at=at)
   if not isinstance(claims,dict):return False
   if (claims.get("tenant_id")!=tenant_id or claims.get("device_id")!=device_id
       or not isinstance(claims.get("sub"),str) or not claims.get("sub")
       or not isinstance(claims.get("jti"),str) or not claims.get("jti")
       or claims.get("scope")!="doobr:mobile:replay"):return False
   if self.revocation.is_revoked(issuer=self.issuer,subject=claims["sub"],
      token_id=claims["jti"],device_id=device_id,at=at) is not False:return False
   return self.device_verifier.verify_bound_device(
    tenant_id=tenant_id,device_id=device_id,subject=claims["sub"],at=at) is True
  except Exception:return False
