"""BNB-6.5 strict deployable provider contract: never mints external acceptance."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parent
PROVIDERS=("identity","pay_wallet","compliance","search","travel","location","notifications")
AUTHORITY={"identity":"BNB_IDENTITY","pay_wallet":"BNB_PAY",
 "compliance":"BNB_COMPLIANCE_AUTHORITY","search":"BNB_DISCOVERY_CONSUMER",
 "travel":"BNB_DISCOVERY_CONSUMER","location":"BNB_LOCATION_AUTHORITY",
 "notifications":"BNB_NOTIFICATION"}
PLACEHOLDER="OPERATOR_APPROVED_"
class ProviderBlocked(ValueError):pass

def require(value,code):
    if not value:raise ProviderBlocked(code)

def validate(config,*,production=False):
    require(type(config) is dict and set(config)=={"schema","production_acceptance_verified","activation","providers"} and
            config["schema"]=="420.bnb.providers.v1","PROVIDER_SCHEMA_INVALID")
    require(config["production_acceptance_verified"] is False,"SYNTHETIC_ACCEPTANCE_FORBIDDEN")
    require(config["activation"]=={"booking":False,"payment_execution":False,
            "travel_booking":False,"notifications_delivery":False},"PROVIDER_ACTIVATION_FORBIDDEN")
    providers=config["providers"]
    require(type(providers) is dict and set(providers)==set(PROVIDERS),"PROVIDER_INVENTORY_INVALID")
    for name in PROVIDERS:
        item=providers[name]
        require(type(item) is dict and set(item)=={"service_identity","origin","trust_root","issuer",
          "audience","status","timeout_seconds","retries","redirects","credential_mode","live_enabled"},
          "PROVIDER_FIELDS_INVALID")
        require(item["service_identity"]=="bnb-provider-"+name.replace("_","-") and
                item["issuer"]==AUTHORITY[name],"PROVIDER_IDENTITY_MISMATCH")
        require(item["status"]=="blocked_external_approval" and item["live_enabled"] is False,
                "PROVIDER_LIVE_APPROVAL_FORBIDDEN")
        require(type(item["timeout_seconds"]) is int and 1<=item["timeout_seconds"]<=10 and
                type(item["retries"]) is int and item["retries"]==0 and
                item["redirects"] is False,"PROVIDER_NETWORK_POLICY_INVALID")
        require(item["credential_mode"]=="mounted_external_secret","PROVIDER_INLINE_SECRET_FORBIDDEN")
        for field in ("origin","trust_root","audience"):
            value=item[field]
            require(type(value) is str and len(value)<=512 and value and not any(c.isspace() for c in value),
                    "PROVIDER_BINDING_INVALID")
        origin=item["origin"]
        if not origin.startswith(PLACEHOLDER):
            u=urlsplit(origin)
            require(u.scheme=="https" and u.hostname and not u.username and not u.password and
                not u.query and not u.fragment and u.path in ("","/") and
                u.port in (None,443),"PROVIDER_HTTPS_REQUIRED")
        if not item["trust_root"].startswith(PLACEHOLDER):
            require(re.fullmatch(r"/run/secrets/[a-z0-9_-]+\.pem",item["trust_root"]) is not None,
                    "PROVIDER_TRUST_MOUNT_REQUIRED")
        if production:
            require(not any(item[x].startswith(PLACEHOLDER) for x in ("origin","trust_root","audience")),
                    "PROVIDER_UNRESOLVED_BINDINGS")
    return True

def load(path,*,production=False):
    p=Path(path)
    require(p.is_absolute() and not p.is_symlink() and p.is_file() and p.stat().st_size<=65536,
            "PROVIDER_MOUNT_INVALID")
    try:return validate(json.loads(p.read_text()),production=production)
    except (ValueError,UnicodeError) as e:
        if isinstance(e,ProviderBlocked):raise
        raise ProviderBlocked("PROVIDER_JSON_INVALID") from None

if __name__=="__main__":
    validate(json.loads((ROOT/"providers.template.v1.json").read_text()))
    print("BNB65_PROVIDER_TEMPLATE_PASS; external authority blocked")
