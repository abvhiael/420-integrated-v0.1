import importlib.util
from pathlib import Path
import pytest
from fastapi import HTTPException
sp=importlib.util.spec_from_file_location("bnb69",Path(__file__).resolve().parents[1]/"authority.py")
m=importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
@pytest.fixture
def env(monkeypatch):
 for k,v in {"BNB_OPS_ISSUER":"issuer","BNB_OPS_AUDIENCE":"aud","BNB_OPS_PUBLIC_KEY_PEM":"key"}.items():
  monkeypatch.setenv(k,v)
 return monkeypatch
def claims():
 return {"iss":"issuer","aud":"aud","sub":"actor","iat":100,"nbf":100,"exp":200,"jti":"nonce-12345","purpose":"ops"}
def verify(monkeypatch,payload,subject=None):
 monkeypatch.setattr(m.jwt,"decode",lambda *args,**kwargs:payload)
 return m.verify_authority("proof","BNB_OPS","ops",subject)
def test_valid_scope(env):
 assert verify(env,claims(),subject="actor")["sub"]=="actor"
@pytest.mark.parametrize("field,value",[("iat",True),("iat",float("nan")),("exp",float("inf")),("nbf","100"),("exp",99),("exp",500),("nbf",202),("nbf",90),("sub",""),("sub","x"*257),("jti","short"),("jti","bad\nnonce")])
def test_invalid_claims(env,field,value):
 data=claims();data[field]=value
 with pytest.raises(HTTPException) as e:verify(env,data)
 assert e.value.status_code==401
def test_cross_account_scope(env):
 with pytest.raises(HTTPException) as e:verify(env,claims(),subject="other")
 assert e.value.status_code==403
def test_issuer_unavailable(env):
 env.delenv("BNB_OPS_PUBLIC_KEY_PEM")
 with pytest.raises(HTTPException) as e:m.verify_authority("proof","BNB_OPS","ops")
 assert e.value.status_code==503
def test_wrong_purpose(env):
 data=claims();data["purpose"]="admin"
 with pytest.raises(HTTPException) as e:verify(env,data)
 assert e.value.status_code==401
