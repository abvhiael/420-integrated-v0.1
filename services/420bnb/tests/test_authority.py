"""Authority provenance, purpose and replay protections (test signer only)."""
import importlib.util
from pathlib import Path
from datetime import datetime,timezone
import jwt
import pytest
from fastapi import HTTPException
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat

spec=importlib.util.spec_from_file_location("authority",Path(__file__).resolve().parents[1]/"authority.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

@pytest.fixture
def issuer(monkeypatch):
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    monkeypatch.setenv("BNB_RECOVERY_ISSUER","https://recovery.test.invalid")
    monkeypatch.setenv("BNB_RECOVERY_AUDIENCE","420bnb-recovery")
    monkeypatch.setenv("BNB_RECOVERY_PUBLIC_KEY_PEM",
      key.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    def sign(**options):
        n=int(datetime.now(timezone.utc).timestamp())
        data=dict(iss="https://recovery.test.invalid",aud="420bnb-recovery",sub="a",
                  iat=n,nbf=n,exp=n+120,jti="proof123",purpose="account-recovery")
        data.update(options)
        return jwt.encode(data,key,algorithm="RS256")
    return sign

def test_recovery_proof_is_purpose_scoped(issuer):
    assert mod.verify_authority(issuer(),"BNB_RECOVERY","account-recovery","a")["jti"]=="proof123"
    for claim in [dict(purpose="property-control"),dict(sub="another"),
                  dict(aud="420bnb"),dict(exp=0),dict(iss="https://evil.invalid")]:
        with pytest.raises(HTTPException):
            mod.verify_authority(issuer(**claim),"BNB_RECOVERY","account-recovery","a")

def test_recovery_provider_missing_rejects(issuer,monkeypatch):
    monkeypatch.delenv("BNB_RECOVERY_PUBLIC_KEY_PEM")
    with pytest.raises(HTTPException) as error:
        mod.verify_authority(issuer(),"BNB_RECOVERY","account-recovery","a")
    assert error.value.status_code==503
