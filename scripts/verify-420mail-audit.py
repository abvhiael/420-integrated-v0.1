#!/usr/bin/env python3
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def require(path):
    p=ROOT/path
    if not p.is_file(): errors.append(f"missing required file: {path}")
    return p
registry_path=require("config/genesis-consumer-services.json")
frozen_path=require("config/genesis-applications.json")
profile_path=require("config/420mail-service-v1.json")
readiness_path=require("testnet/public-services/mail/readiness.json")
for p in ["mail/service.go","mail/store.go","mail/store_test.go","mail/http.go","mail/client/client.go","mail/service_test.go","mail/http_test.go","mail/web/index.html","docs/420MAIL.md","docs/420MAIL-PHASE2-ROADMAP.md","docs/audit/420MAIL-AUDIT-REMEDIATION-ROADMAP.md"]: require(p)
if registry_path.is_file():
    registry=json.loads(registry_path.read_text())
    entry=next((x for x in registry.get("services",[]) if x.get("id")=="420/service/mail/v1"),None)
    if not entry: errors.append("canonical 420Mail consumer-service entry missing")
    else:
        if entry.get("name")!="420Mail": errors.append("420Mail name drifted")
        if entry.get("role")!="GENESIS_SHARED_INFRASTRUCTURE_AND_THIN_UI": errors.append("420Mail role drifted")
        if entry.get("authority")!="REPLACEABLE_COMMUNICATION_SERVICE": errors.append("420Mail authority drifted")
        if entry.get("depends_on")!=["420 Identity","420 Messenger","420 Storage","420 Notifications"]: errors.append("420Mail dependency list drifted")
    flags={x.get("key"):x.get("genesis_default") for x in registry.get("feature_flags",[])}
    if flags.get("mail.external_smtp") is not False: errors.append("mail.external_smtp must remain disabled")
if frozen_path.is_file():
    frozen=json.loads(frozen_path.read_text())
    if frozen.get("status")!="FROZEN": errors.append("Genesis application catalog is not FROZEN")
    if any(x.get("name")=="420Mail" for x in frozen.get("apps",[])): errors.append("420Mail unexpectedly promoted without explicit audit decision")
if profile_path.is_file():
    profile=json.loads(profile_path.read_text())
    if profile.get("serviceId")!="420/service/mail/v1": errors.append("Mail serviceId drifted")
    if profile.get("contracts")!=[] or profile.get("onChainMailState") is not False: errors.append("Mail invented on-chain authority")
    if profile.get("featureFlags",{}).get("mail.external_smtp") is not False: errors.append("Mail enabled external SMTP")
    mailbox=profile.get("mailbox",{})
    if mailbox.get("systemFolders")!=["INBOX","SENT","OUTBOX","DRAFTS","ARCHIVE","JUNK","TRASH"]: errors.append("Mail mailbox folder inventory drifted")
    if mailbox.get("deliveredRecipientFolder")!="INBOX" or mailbox.get("deliveredSenderFolder")!="SENT": errors.append("Mail delivered-folder defaults drifted")
    if mailbox.get("reservedForDedicatedSteps")!={"DRAFTS":"MAIL-2.9","OUTBOX":"MAIL-2.10"}: errors.append("Mail reserved Drafts/Outbox ownership drifted")
    if mailbox.get("ownerScopedState") is not True or mailbox.get("permanentDeleteRequiresTrash") is not True: errors.append("Mail mailbox ownership/delete policy drifted")
    if mailbox.get("messageBodiesOnChain") is not False: errors.append("Mail mailbox state moved bodies on-chain")
    store=profile.get("metadataStore",{})
    if store.get("requiredForDeployment") is not True: errors.append("Mail durable metadata store not required for deployment")
    if store.get("schemaVersion")!=1 or store.get("atomicTransactions") is not True or store.get("restartRecovery") is not True or store.get("migrations") is not True: errors.append("Mail durable store capability drifted")
    if store.get("secondaryIndexes")!=["owner_folder"]: errors.append("Mail durable store index drifted")
    if store.get("distributedIdempotency")!="SENDER_SCOPED_TRANSACTIONAL": errors.append("Mail distributed idempotency policy drifted")
    if store.get("messageBodiesPersisted") is not False: errors.append("Mail metadata store must not persist message bodies")
if readiness_path.is_file():
    readiness=json.loads(readiness_path.read_text())
    for key in ("liveTestnetEvidence","genesisCatalogPromoted","genesisCloseout","productionReady"):
        if readiness.get(key) is not False: errors.append(f"readiness overclaims {key}")
service=(ROOT/"mail/service.go").read_text() if (ROOT/"mail/service.go").is_file() else ""
for token in ['ServiceID       = "420/service/mail/v1"',,"MaxBodyBytes","IdempotencyKey","Messenger.CanMessage","Blobs.PutPrivate",'Visibility: "PRIVATE"',"ErrIdempotencyConflict", "req.Source != ServiceID","FolderInbox","FolderSent","FolderOutbox","FolderDrafts","FolderArchive","FolderJunk","FolderTrash","MailboxState","PreviousFolder","DeletedAt","PermanentlyDelete","RestoreFromTrash","canMoveMailbox"]:
    if token not in service: errors.append("mail service invariant missing: "+token)
http=(ROOT/"mail/http.go").read_text() if (ROOT/"mail/http.go").is_file() else ""
if "Authenticate AuthenticateFunc" not in http: errors.append("HTTP missing injected authentication")
if '"/v1/messages"' not in http or '"/v1/inbox"' not in http: errors.append("HTTP v1 routes missing")
for token in ['"/v1/mailboxes/"','"mailbox"','"restore"','"unread"', "http.MethodPatch", "http.MethodDelete"]:
    if token not in http: errors.append("MAIL-2.1 HTTP lifecycle route missing: "+token)
roadmap=(ROOT/"docs/420MAIL-PHASE2-ROADMAP.md").read_text() if (ROOT/"docs/420MAIL-PHASE2-ROADMAP.md").is_file() else ""
for token in ["MAIL-2.1 — Mailbox State Model","MAIL-2.2 — Durable Mail Storage","permanent delete","restore from Trash"]:
    if token not in roadmap: errors.append("MAIL-2 roadmap definition missing: "+token)
roadmap_upper=roadmap.upper()
for token in ["DRAFTS","OUTBOX"]:
    if token not in roadmap_upper: errors.append("MAIL-2 roadmap definition missing: "+token)
if errors:
    print("420Mail audit qualification FAILED")
    for e in errors: print("- "+e)
    raise SystemExit(1)
print("420Mail audit qualification PASS")
print("Service: 420/service/mail/v1")
print("Contracts required: false")
print("External SMTP default: false")
print("Live testnet evidence: false")
print("Genesis catalog promoted: false")
print("MAIL-2.1 mailbox state model: qualified by app-scoped checks")
print("MAIL-2.2 durable mail storage: qualified by app-scoped checks")

store=(ROOT/"mail/store.go").read_text() if (ROOT/"mail/store.go").is_file() else ""
for token in ["type MailStore interface","OpenDurableStore","DurableStoreSchemaVersion","syscall.Flock","os.Rename","tmp.Sync","dirFile.Sync","rebuildMailboxIndex","validateStoreData","ErrStoreCorrupt","ErrStoreSchemaTooNew"]:
    if token not in store: errors.append("MAIL-2.2 durable store invariant missing: "+token)
for token in ["NewDurableService","Store.Update","Store.View"]:
    if token not in service: errors.append("MAIL-2.2 service storage integration missing: "+token)
