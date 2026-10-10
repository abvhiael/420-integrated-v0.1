import importlib.util
from pathlib import Path
from datetime import datetime,timedelta,timezone
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException
import pytest

spec=importlib.util.spec_from_file_location("bnb_identity",Path(__file__).resolve().parents[1]/"identity.py")
i=importlib.util.module_from_spec(spec);spec.loader.exec_module(i)

@pytest.fixture()
def identity(monkeypatch):
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    public=private.public_key().public_bytes(serialization.Encoding.PEM,
                                           serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv("BNB_IDENTITY_ISSUER","https://identity.example.invalid")
    monkeypatch.setenv("BNB_IDENTITY_AUDIENCE","420bnb")
    monkeypatch.setenv("BNB_IDENTITY_PUBLIC_KEY_PEM",public)
    def token(**overrides):
        now=int(datetime.now(timezone.utc).timestamp())
        data=dict(sub="person1",iss="https://identity.example.invalid",aud="420bnb",
                  exp=now+180,iat=now,nbf=now,jti="issuer-session-1")
        data.update(overrides)
        return jwt.encode(data,private,algorithm="RS256")
    return token

def test_valid_external_identity(identity):
    result=i.verify_external_token(identity())
    assert result["subject"]=="person1"
    assert result["issuer_session_id"]=="issuer-session-1"

@pytest.mark.parametrize("claim,value",[
    ("iss","https://forged.invalid"),("aud","another-app"),("sub",""),
    ("exp",0),("nbf",9999999999)])
def test_reject_invalid_issuer_audience_expiry(identity,claim,value):
    with pytest.raises(HTTPException):
        i.verify_external_token(identity(**{claim:value}))

def test_role_does_not_grant_verification(identity):
    result=i.verify_external_token(identity(role="admin",verified=True,host=True))
    assert set(result)=={"subject","issuer","issuer_session_id","expires_at"}

def test_provider_missing_fails_closed(identity,monkeypatch):
    monkeypatch.delenv("BNB_IDENTITY_PUBLIC_KEY_PEM")
    with pytest.raises(HTTPException) as e:
        i.verify_external_token(identity())
    assert e.value.status_code==503
