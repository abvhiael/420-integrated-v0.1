"""BNB-6.8 deterministic promotion/rollback preflight; never deploys or self-approves."""
import re
from datetime import datetime, timezone

IMAGE=re.compile(r"[A-Za-z0-9][A-Za-z0-9./_-]*@sha256:[0-9a-f]{64}\Z")
SHA=re.compile(r"[0-9a-f]{40}\Z")
class ReleaseBlocked(ValueError):pass

def require(ok,code):
    if not ok:raise ReleaseBlocked(code)

def evaluate(manifest, *, approved=False, ledger_verified=False, backup_restored=False,
             compatibility_verified=False, runtime_ready=False, independent_receipts=False):
    require(type(manifest) is dict and set(manifest)=={
        "schema","release_sha","images","migration_version","flags","rollback_policy","approval"}, "RELEASE_SCHEMA_INVALID")
    require(manifest["schema"]=="420.bnb.release.v1" and
            isinstance(manifest["release_sha"],str) and SHA.fullmatch(manifest["release_sha"]), "RELEASE_SHA_INVALID")
    images=manifest["images"]
    require(type(images) is dict and set(images)=={"api","web","ingress","worker"} and
            all(type(v) is str and IMAGE.fullmatch(v) for v in images.values()),"IMMUTABLE_IMAGES_REQUIRED")
    require(type(manifest["migration_version"]) is int and manifest["migration_version"]==30,"SCHEMA_VERSION_INVALID")
    require(manifest["flags"]=={"booking_enabled":False,"financial_execution":False,
            "travel_bnb_booking":False},"ACTIVATION_FORBIDDEN")
    require(manifest["rollback_policy"]=={"automatic_database_down_migration":False,
            "restore_requires_verified_backup":True,
            "previous_binary_requires_compatibility_proof":True}, "ROLLBACK_POLICY_INVALID")
    require(manifest["approval"]=={"independent_operator_verified":False,
            "live_accepted":False}, "SYNTHETIC_APPROVAL_FORBIDDEN")
    checks={"operator_approved":approved,"ledger_verified":ledger_verified,
            "backup_restored":backup_restored,"compatibility_verified":compatibility_verified,
            "runtime_ready":runtime_ready,"independent_receipts":independent_receipts}
    require(all(type(v) is bool for v in checks.values()),"RELEASE_INPUT_INVALID")
    # No repository fixture or caller boolean can mint external acceptance.
    return {"manifest_valid":True,"ready_to_promote":False,
            "blocked":["INDEPENDENT_DEPLOYMENT_ACCEPTANCE_REQUIRED"]+
                      [k.upper()+"_REQUIRED" for k,v in checks.items() if not v],
            "automatic_database_rollback":False}

def rollback(manifest, *, previous_image, backup_verified=False,
             schema_compatibility_verified=False, independent_approval=False):
    evaluate(manifest)
    require(type(previous_image) is str and IMAGE.fullmatch(previous_image),"ROLLBACK_IMAGE_INVALID")
    require(type(backup_verified) is bool and type(schema_compatibility_verified) is bool and
            type(independent_approval) is bool,"ROLLBACK_INPUT_INVALID")
    return {"executable":False,"requires_operator_review":True,
            "database_down_migration":False,
            "blockers":[key for key,ok in (("BACKUP_NOT_VERIFIED",backup_verified),
                ("SCHEMA_COMPATIBILITY_NOT_VERIFIED",schema_compatibility_verified),
                ("INDEPENDENT_APPROVAL_REQUIRED",independent_approval)) if not ok]+
                ["LIVE_ROLLBACK_REHEARSAL_REQUIRED"]}
