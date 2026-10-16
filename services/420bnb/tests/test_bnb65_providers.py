"""BNB-6.5 adversarial provider inventory and fail-closed acceptance checks."""
import copy
import importlib.util
import json
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("bnb65",ROOT/"provider_adapters.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
@pytest.fixture
def contract():return json.loads((ROOT/"providers.template.v1.json").read_text())
def test_complete_provider_inventory_while_release_blocked(contract):
    assert m.validate(contract)
    assert set(contract["providers"])==set(m.PROVIDERS)
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_UNRESOLVED_BINDINGS"):
        m.validate(contract,production=True)
@pytest.mark.parametrize("provider",list(m.PROVIDERS))
def test_no_provider_can_self_accept(contract,provider):
    contract["providers"][provider]["live_enabled"]=True
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_LIVE_APPROVAL_FORBIDDEN"):m.validate(contract)
@pytest.mark.parametrize("provider",list(m.PROVIDERS))
def test_cross_provider_identity_cannot_cross_scope(contract,provider):
    contract["providers"][provider]["issuer"]="BNB_IDENTITY" if provider!="identity" else "BNB_PAY"
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_IDENTITY_MISMATCH"):m.validate(contract)
@pytest.mark.parametrize("bad",["http://provider.example","https://a:b@provider.example",
 "https://provider.example:8080","https://provider.example/path"])
def test_unsafe_provider_origin_rejected(contract,bad):
    contract["providers"]["identity"]["origin"]=bad
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_HTTPS_REQUIRED"):m.validate(contract)
def test_unsigned_metadata_never_authorizes_financial_execution(contract):
    contract["production_acceptance_verified"]=True
    with pytest.raises(m.ProviderBlocked,match="SYNTHETIC_ACCEPTANCE_FORBIDDEN"):m.validate(contract)
    contract["production_acceptance_verified"]=False
    contract["activation"]["payment_execution"]=True
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_ACTIVATION_FORBIDDEN"):m.validate(contract)
def test_inline_private_credential_and_redirects_rejected(contract):
    contract["providers"]["pay_wallet"]["credential_mode"]="inline_private_key"
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_INLINE_SECRET_FORBIDDEN"):m.validate(contract)
    contract["providers"]["pay_wallet"]["credential_mode"]="mounted_external_secret"
    contract["providers"]["pay_wallet"]["redirects"]=True
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_NETWORK_POLICY_INVALID"):m.validate(contract)
def test_resolved_provider_must_keep_external_approval_blocked(contract):
    for provider in contract["providers"].values():
        provider["origin"]="https://provider.example.test"
        provider["trust_root"]="/run/secrets/provider.pem"
        provider["audience"]="urn:420:bnb:provider"
    assert m.validate(contract,production=True)
    contract["providers"]["notifications"]["status"]="approved"
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_LIVE_APPROVAL_FORBIDDEN"):
        m.validate(contract,production=True)
def test_mount_must_not_be_symlink(tmp_path,contract):
    target=tmp_path/"provider.json";target.write_text(json.dumps(contract))
    symlink=tmp_path/"alias.json";symlink.symlink_to(target)
    with pytest.raises(m.ProviderBlocked,match="PROVIDER_MOUNT_INVALID"):m.load(symlink)
    assert m.load(target)
