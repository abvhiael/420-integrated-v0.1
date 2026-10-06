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
for p in ["mail/service.go","mail/store.go","mail/store_test.go","mail/organization.go","mail/organization_test.go","mail/search.go","mail/search_test.go","mail/rules.go","mail/rules_test.go","mail/trust.go","mail/trust_test.go","mail/spam.go","mail/spam_test.go","mail/conversation.go","mail/conversation_test.go","mail/draft.go","mail/draft_test.go","mail/http.go","mail/client/client.go","mail/service_test.go","mail/http_test.go","mail/web/index.html","docs/420MAIL.md","docs/420MAIL-PHASE2-ROADMAP.md","docs/audit/420MAIL-AUDIT-REMEDIATION-ROADMAP.md"]: require(p)
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
    if mailbox.get("reservedForDedicatedSteps")!={}: errors.append("Mail reserved-folder roadmap ownership drifted")
    if mailbox.get("systemManagedFolders")!=["OUTBOX","DRAFTS"]: errors.append("Mail system-managed folder ownership drifted")
    if mailbox.get("ownerScopedState") is not True or mailbox.get("permanentDeleteRequiresTrash") is not True: errors.append("Mail mailbox ownership/delete policy drifted")
    if mailbox.get("messageBodiesOnChain") is not False: errors.append("Mail mailbox state moved bodies on-chain")
    store=profile.get("metadataStore",{})
    if store.get("requiredForDeployment") is not True: errors.append("Mail durable metadata store not required for deployment")
    if store.get("schemaVersion")!=8 or store.get("atomicTransactions") is not True or store.get("restartRecovery") is not True or store.get("migrations") is not True: errors.append("Mail durable store capability drifted")
    if store.get("secondaryIndexes")!=["owner_folder","owner_label","owner_custom_folder","owner_conversation","owner_draft"]: errors.append("Mail durable store index drifted")
    if store.get("distributedIdempotency")!="SENDER_SCOPED_TRANSACTIONAL": errors.append("Mail distributed idempotency policy drifted")
    if store.get("messageBodiesPersisted") is not False: errors.append("Mail metadata store must not persist message bodies")
    org=profile.get("organization",{})
    if org.get("userLabels") is not True or org.get("customFolders") is not True or org.get("bulkAssignment") is not True: errors.append("MAIL-2.3 organization capability drifted")
    if org.get("systemLabels")!=["STARRED","PINNED","MUTED","UNREAD"]: errors.append("MAIL-2.3 system labels drifted")
    if org.get("ownerScoped") is not True or org.get("systemLabelsImmutable") is not True: errors.append("MAIL-2.3 organization authorization drifted")
    search=profile.get("privateSearch",{})
    if search.get("enabled") is not True or search.get("ownerScoped") is not True: errors.append("MAIL-2.4 private search capability drifted")
    if search.get("publicIndexing") is not False or search.get("public420SearchIntegration") is not False: errors.append("MAIL-2.4 exposed private mail to public search")
    if search.get("bodySearch")!="ON_DEMAND_PRIVATE_BLOB": errors.append("MAIL-2.4 body-search boundary drifted")
    if search.get("maxQueryBytes")!=256 or search.get("maxScanItems")!=500 or search.get("maxPageSize")!=100: errors.append("MAIL-2.4 search bounds drifted")
    if search.get("permanentlyDeletedExcluded") is not True: errors.append("MAIL-2.4 deleted-mail search policy drifted")
    rules=profile.get("rulesEngine",{})
    if rules.get("enabled") is not True or rules.get("ownerScoped") is not True or rules.get("appliesTo")!="INCOMING_RECIPIENT_COPY": errors.append("MAIL-2.5 rule scope drifted")
    if rules.get("conditions")!=["sender_equals","content_contains","source_equals"] or rules.get("conditionsCombine")!="AND": errors.append("MAIL-2.5 rule conditions drifted")
    if rules.get("allowedActionFolders")!=["INBOX","ARCHIVE","JUNK","TRASH"]: errors.append("MAIL-2.5 rule folder authority drifted")
    if rules.get("maxRulesPerUser")!=100 or rules.get("maxRuleNameBytes")!=80 or rules.get("maxContentMatchBytes")!=256 or rules.get("maxActionLabels")!=20: errors.append("MAIL-2.5 rule bounds drifted")
    if rules.get("atomicWithDelivery") is not True or rules.get("publicIndexing") is not False: errors.append("MAIL-2.5 rule delivery/privacy boundary drifted")
    trust=profile.get("trustControls",{})
    if trust.get("enabled") is not True or trust.get("ownerScoped") is not True: errors.append("MAIL-2.6 trust-control scope drifted")
    if trust.get("entryKinds")!=["IDENTITY","PHRASE","APPLICATION"] or trust.get("dispositions")!=["BLOCK","ALLOW","MUTE"]: errors.append("MAIL-2.6 trust inventory drifted")
    if trust.get("maxEntriesPerUser")!=250 or trust.get("maxValueBytes")!=256: errors.append("MAIL-2.6 trust bounds drifted")
    if trust.get("requireTrustedMode") is not True or trust.get("identityApplicationBlockPrecedence")!="ABSOLUTE": errors.append("MAIL-2.6 allow/block precedence drifted")
    if trust.get("trustedIdentityApplicationBypassesPhraseBlock") is not True or trust.get("muteSuppressesNotification") is not True or trust.get("muteMarksRecipientCopy") is not True: errors.append("MAIL-2.6 trust behavior drifted")
    if trust.get("idempotentReplayPreserved") is not True or trust.get("atomicDeliveryRecheck") is not True or trust.get("publicIndexing") is not False: errors.append("MAIL-2.6 trust safety/privacy drifted")
    spam=profile.get("spamProtection",{})
    if spam.get("enabled") is not True or spam.get("ownerScopedReputation") is not True: errors.append("MAIL-2.7 spam protection scope drifted")
    if spam.get("reputationInputs")!=["spam_reports","phishing_reports","false_positive_releases"]: errors.append("MAIL-2.7 reputation inputs drifted")
    if spam.get("duplicateFingerprintDetection") is not True or spam.get("duplicateThreshold")!=4: errors.append("MAIL-2.7 duplicate defense drifted")
    if spam.get("phishingHeuristics")!=["url_userinfo","ip_literal_link","punycode_link","insecure_http_link","credential_or_urgency_lure_with_link"] or spam.get("phishingQuarantineScore")!=3: errors.append("MAIL-2.7 phishing defense drifted")
    if spam.get("automaticQuarantineFolder")!="JUNK" or spam.get("quarantineMutesRecipientCopy") is not True or spam.get("quarantineSuppressesNotification") is not True: errors.append("MAIL-2.7 quarantine semantics drifted")
    if spam.get("explicitReleaseRequiredForInboxRestore") is not True or spam.get("trustedIdentityApplicationBypassesSpamSignals") is not True or spam.get("trustedIdentityApplicationBypassesPhishing") is not False: errors.append("MAIL-2.7 trust/quarantine precedence drifted")
    if spam.get("abuseReportKinds")!=["SPAM","PHISHING"] or spam.get("oneAbuseReportPerOwnerMessage") is not True: errors.append("MAIL-2.7 abuse-report semantics drifted")
    if spam.get("publicIndexing") is not False or spam.get("messageBodiesPersisted") is not False: errors.append("MAIL-2.7 spam privacy boundary drifted")
    conversations=profile.get("conversations",{})
    if conversations.get("enabled") is not True or conversations.get("ownerScoped") is not True or conversations.get("participantView") is not True: errors.append("MAIL-2.8 conversation scope drifted")
    if conversations.get("replyModel")!="PARENT_MESSAGE_BOUND" or conversations.get("deterministicRootConversationId") is not True: errors.append("MAIL-2.8 reply identity drifted")
    if conversations.get("orderedMessages")!="CREATED_AT_ASC_ID_ASC" or conversations.get("orderedConversations")!="LATEST_AT_DESC_ID_ASC": errors.append("MAIL-2.8 ordering drifted")
    if conversations.get("maxMessagesPerConversation")!=1000 or conversations.get("threadArchive") is not True or conversations.get("threadMute") is not True: errors.append("MAIL-2.8 thread state drifted")
    if conversations.get("archivedFutureRepliesFolder")!="ARCHIVE" or conversations.get("mutedFutureRepliesSuppressNotification") is not True: errors.append("MAIL-2.8 thread delivery behavior drifted")
    if conversations.get("arbitraryConversationInjectionRejected") is not True or conversations.get("deletedParentReplyRejected") is not True or conversations.get("publicIndexing") is not False: errors.append("MAIL-2.8 conversation safety/privacy drifted")
    drafts=profile.get("drafts",{})
    if drafts.get("enabled") is not True or drafts.get("ownerScoped") is not True or drafts.get("autosave") is not True or drafts.get("recovery") is not True or drafts.get("edit") is not True or drafts.get("discard") is not True: errors.append("MAIL-2.9 draft capability drifted")
    if drafts.get("bodyStorage")!="PRIVATE_ENCRYPTED_BLOB_PROVIDER" or drafts.get("discardDeletesPrivateBlob") is not True: errors.append("MAIL-2.9 draft private-storage boundary drifted")
    if drafts.get("multiDevice")!="OPTIMISTIC_VERSIONED" or drafts.get("staleWrite")!="REJECT_CONFLICT" or drafts.get("deterministicIdFromOwnerAutosaveKey") is not True: errors.append("MAIL-2.9 multi-device semantics drifted")
    if drafts.get("maxDraftsPerUser")!=500 or drafts.get("maxAutosaveKeyBytes")!=128 or drafts.get("listOrdering")!="UPDATED_AT_DESC_ID_ASC": errors.append("MAIL-2.9 draft bounds/order drifted")
    if drafts.get("publicIndexing") is not False or drafts.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.9 draft privacy boundary drifted")
    delivery=profile.get("deliveryQueue",{})
    if delivery.get("enabled") is not True or delivery.get("ownerScoped") is not True: errors.append("MAIL-2.10 delivery queue scope drifted")
    if delivery.get("lifecycle")!=["QUEUED","SENDING","RETRYING","DELIVERED","FAILED","CANCELLED"]: errors.append("MAIL-2.10 lifecycle drifted")
    if delivery.get("senderMailboxFolder")!="OUTBOX" or delivery.get("deliveredSenderFolder")!="SENT" or delivery.get("deliveredRecipientFolder")!="INBOX": errors.append("MAIL-2.10 mailbox lifecycle drifted")
    if delivery.get("maxAttempts")!=3 or delivery.get("maxActiveItemsPerSender")!=1000: errors.append("MAIL-2.10 retry/capacity bounds drifted")
    if delivery.get("deterministicIdempotency") is not True or delivery.get("crashRecovery")!="SENDING_REPROCESS_SAFE": errors.append("MAIL-2.10 queue safety drifted")
    if delivery.get("publicIndexing") is not False or delivery.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.10 privacy boundary drifted")
    onboarding=profile.get("onboarding",{})
    if onboarding.get("enabled") is not True: errors.append("MAIL-2.11 onboarding capability drifted")
    if onboarding.get("methods")!=["GOOGLE","APPLE","PASSKEY","EXISTING_WALLET"]: errors.append("MAIL-2.11 onboarding methods drifted")
    if onboarding.get("authority")!="CANONICAL_WALLET_IDENTITY_ADAPTER" or onboarding.get("sessionIssuer")!="WALLET_IDENTITY_AUTHORITY": errors.append("MAIL-2.11 Wallet/Identity authority boundary drifted")
    if onboarding.get("publicEntryPoint") is not True or onboarding.get("identityBindingRequired") is not True or onboarding.get("walletBindingRequired") is not True: errors.append("MAIL-2.11 onboarding binding drifted")
    if onboarding.get("replayProtection")!="AUTHORITY_ADAPTER_REQUIRED": errors.append("MAIL-2.11 replay-protection boundary drifted")
    if onboarding.get("custodialSigning") is not False or onboarding.get("privateKeyInput") is not False or onboarding.get("seedPhraseInput") is not False or onboarding.get("passkeyPrivateMaterialInput") is not False: errors.append("MAIL-2.11 custodial boundary drifted")
    if onboarding.get("credentialPersistence") is not False or onboarding.get("publicIndexing") is not False or onboarding.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.11 onboarding privacy boundary drifted")
    if "420 Wallet" not in profile.get("dependencies",[]): errors.append("MAIL-2.11 Wallet dependency missing")
    security=profile.get("passkeyFirstSecurity",{})
    if security.get("enabled") is not True or security.get("authority")!="CANONICAL_WALLET_IDENTITY_SECURITY_ADAPTER" or security.get("authenticatedOwnerOnly") is not True: errors.append("MAIL-2.12 security authority boundary drifted")
    passkeys=security.get("passkeys",{})
    if passkeys.get("enabled") is not True or passkeys.get("enrollment") is not True or passkeys.get("revocation") is not True: errors.append("MAIL-2.12 passkey capability drifted")
    if passkeys.get("authorizationEpochBound") is not True or passkeys.get("staleEpochActiveRejected") is not True or passkeys.get("privateMaterialInput") is not False: errors.append("MAIL-2.12 passkey epoch/private-material boundary drifted")
    devices=security.get("devices",{})
    if devices.get("enrollment") is not True or devices.get("revocation") is not True or devices.get("lostDeviceResponse")!="REVOKE_BOUND_AUTHORIZATION_THROUGH_WALLET_AUTHORITY": errors.append("MAIL-2.12 device security drifted")
    recovery=security.get("recovery",{})
    if recovery.get("model")!="SMARTACCOUNT420_TIMELOCKED" or recovery.get("actions")!=["SET_AUTHORITY","PROPOSE","CANCEL","FINALIZE"] or recovery.get("localTimelockOverride") is not False or recovery.get("signingAuthority")!="WALLET_ONLY": errors.append("MAIL-2.12 recovery authority drifted")
    sessions=security.get("sessions",{})
    if sessions.get("listing") is not True or sessions.get("revocation") is not True or sessions.get("authorizationEpochBound") is not True or sessions.get("staleEpochActiveRejected") is not True: errors.append("MAIL-2.12 session security drifted")
    alerts=security.get("alerts",{})
    if alerts.get("listing") is not True or alerts.get("acknowledgement") is not True or alerts.get("authority")!="WALLET_IDENTITY_SECURITY_AUTHORITY": errors.append("MAIL-2.12 security alerts drifted")
    if security.get("securityStatePersistence")!="CANONICAL_AUTHORITY_ONLY" or security.get("credentialPersistence") is not False or security.get("sessionSecretPersistence") is not False or security.get("publicIndexing") is not False or security.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.12 security persistence/privacy boundary drifted")
    wallet=profile.get("walletFunctions",{})
    if wallet.get("enabled") is not True or wallet.get("authority")!="CANONICAL_WALLET_SMARTACCOUNT_ADAPTER" or wallet.get("authenticatedOwnerOnly") is not True: errors.append("MAIL-2.13 wallet authority boundary drifted")
    if wallet.get("actions")!=["TRANSACTION","MESSAGE_SIGNATURE"] or wallet.get("prepareIntentOnly") is not True: errors.append("MAIL-2.13 wallet action inventory drifted")
    if wallet.get("signing")!="WALLET_ONLY" or wallet.get("submission")!="WALLET_ONLY" or wallet.get("simulation")!="WALLET_ONLY": errors.append("MAIL-2.13 wallet signing/submission boundary drifted")
    if wallet.get("chainValidation")!="AUTHORITY_REQUIRED" or wallet.get("authorizationEpoch")!="AUTHORITY_REQUIRED" or wallet.get("explicitWalletApprovalRequired") is not True: errors.append("MAIL-2.13 wallet authorization boundary drifted")
    verification=wallet.get("verification",{})
    if verification.get("kinds")!=["TRANSACTION","SIGNATURE"] or verification.get("authority")!="CANONICAL_WALLET_RPC_IDENTITY_ADAPTER": errors.append("MAIL-2.13 verification inventory drifted")
    if verification.get("canonicalEvidenceRequired") is not True or verification.get("submissionAckIsCompletion") is not False or verification.get("finalizedSeparateFromVerified") is not True: errors.append("MAIL-2.13 canonical verification boundary drifted")
    if wallet.get("privateKeyInput") is not False or wallet.get("seedPhraseInput") is not False or wallet.get("passkeyPrivateMaterialInput") is not False: errors.append("MAIL-2.13 wallet secret-input boundary drifted")
    if wallet.get("credentialPersistence") is not False or wallet.get("actionPersistence") is not False or wallet.get("verificationEvidencePersistence") is not False or wallet.get("publicIndexing") is not False or wallet.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.13 wallet persistence/privacy boundary drifted")
if readiness_path.is_file():
    readiness=json.loads(readiness_path.read_text())
    for key in ("liveTestnetEvidence","genesisCatalogPromoted","genesisCloseout","productionReady"):
        if readiness.get(key) is not False: errors.append(f"readiness overclaims {key}")
service=(ROOT/"mail/service.go").read_text() if (ROOT/"mail/service.go").is_file() else ""
for token in ['ServiceID       = "420/service/mail/v1"',"MaxBodyBytes","IdempotencyKey","Messenger.CanMessage","Blobs.PutPrivate",'Visibility: "PRIVATE"',"ErrIdempotencyConflict", "req.Source != ServiceID","FolderInbox","FolderSent","FolderOutbox","FolderDrafts","FolderArchive","FolderJunk","FolderTrash","MailboxState","PreviousFolder","DeletedAt","PermanentlyDelete","RestoreFromTrash","canMoveMailbox"]:
    if token not in service: errors.append("mail service invariant missing: "+token)
http=(ROOT/"mail/http.go").read_text() if (ROOT/"mail/http.go").is_file() else ""
if "AuthenticateFunc" not in http: errors.append("HTTP missing injected authentication")
if '"/v1/messages"' not in http or '"/v1/inbox"' not in http: errors.append("HTTP v1 routes missing")
for token in ['"/v1/mailboxes/"','"mailbox"','"restore"','"unread"', "http.MethodPatch", "http.MethodDelete"]:
    if token not in http: errors.append("MAIL-2.1 HTTP lifecycle route missing: "+token)
roadmap=(ROOT/"docs/420MAIL-PHASE2-ROADMAP.md").read_text() if (ROOT/"docs/420MAIL-PHASE2-ROADMAP.md").is_file() else ""
for token in ["MAIL-2.1 — Mailbox State Model","MAIL-2.2 — Durable Mail Storage","permanent delete","restore from Trash"]:
    if token not in roadmap: errors.append("MAIL-2 roadmap definition missing: "+token)
roadmap_upper=roadmap.upper()
for token in ["DRAFTS","OUTBOX"]:
    if token not in roadmap_upper: errors.append("MAIL-2 roadmap definition missing: "+token)
store=(ROOT/"mail/store.go").read_text() if (ROOT/"mail/store.go").is_file() else ""
for token in ["type MailStore interface","OpenDurableStore","DurableStoreSchemaVersion","syscall.Flock","os.Rename","tmp.Sync","dirFile.Sync","rebuildMailboxIndex","validateStoreData","ErrStoreCorrupt","ErrStoreSchemaTooNew"]:
    if token not in store: errors.append("MAIL-2.2 durable store invariant missing: "+token)
for token in ["NewDurableService","Store.Update","Store.View"]:
    if token not in service: errors.append("MAIL-2.2 service storage integration missing: "+token)

organization=(ROOT/"mail/organization.go").read_text() if (ROOT/"mail/organization.go").is_file() else ""
for token in ["LabelDefinition","CustomFolder","BulkOrganizationRequest","CreateLabel","CreateCustomFolder","BulkUpdateOrganization","MessagesByLabel","MessagesByCustomFolder","systemLabelPage","matchesSystemLabel","ErrSystemLabelImmutable","MaxBulkOrganizationItems"]:
    if token not in organization: errors.append("MAIL-2.3 organization invariant missing: "+token)
for token in ['"/v1/labels"','"/v1/custom-folders"','"/v1/organization/bulk"','"organization"']:
    if token not in http: errors.append("MAIL-2.3 HTTP route missing: "+token)
search_src=(ROOT/"mail/search.go").read_text() if (ROOT/"mail/search.go").is_file() else ""
for token in ["SearchRequest","SearchResult","SearchMailbox","MaxSearchQueryBytes","MaxSearchScanItems","Blobs.GetPrivate","state.Owner != actor","state.DeletedAt != nil"]:
    if token not in search_src: errors.append("MAIL-2.4 private search invariant missing: "+token)
for token in ['"/v1/search"',"SearchMailbox"]:
    if token not in http: errors.append("MAIL-2.4 HTTP/client search surface missing: "+token)
rules_src=(ROOT/"mail/rules.go").read_text() if (ROOT/"mail/rules.go").is_file() else ""
for token in ["RuleCondition","RuleAction","MailRule","RuleInput","CreateRule","UpdateRule","DeleteRule","applyIncomingRules","ruleMatches","StopProcessing","MaxUserRules","ErrRuleConflict"]:
    if token not in rules_src: errors.append("MAIL-2.5 rules invariant missing: "+token)
for token in ['"/v1/rules"',"CreateRule","UpdateRule","DeleteRule"]:
    if token not in http: errors.append("MAIL-2.5 HTTP rules surface missing: "+token)
client=(ROOT/"mail/client/client.go").read_text() if (ROOT/"mail/client/client.go").is_file() else ""
for token in ["ListRules","CreateRule","UpdateRule","DeleteRule"]:
    if token not in client: errors.append("MAIL-2.5 client rules surface missing: "+token)
trust_src=(ROOT/"mail/trust.go").read_text() if (ROOT/"mail/trust.go").is_file() else ""
for token in ["TrustIdentity","TrustPhrase","TrustApplication","TrustBlock","TrustAllow","TrustMute","TrustSettings","PutTrustEntry","DeleteTrustEntry","UpdateTrustSettings","evaluateTrustPolicy","ErrTrustRejected","MaxTrustEntries"]:
    if token not in trust_src: errors.append("MAIL-2.6 trust invariant missing: "+token)
for token in ['"/v1/trust/entries"','"/v1/trust/settings"',"PutTrustEntry","UpdateTrustSettings"]:
    if token not in http: errors.append("MAIL-2.6 HTTP trust surface missing: "+token)
for token in ["ListTrustEntries","PutTrustEntry","DeleteTrustEntry","GetTrustSettings","UpdateTrustSettings"]:
    if token not in client: errors.append("MAIL-2.6 client trust surface missing: "+token)
for token in ["evaluateTrustPolicy","recipientMuted","!recipientMuted"]:
    if token not in service: errors.append("MAIL-2.6 delivery trust integration missing: "+token)
spam_src=(ROOT/"mail/spam.go").read_text() if (ROOT/"mail/spam.go").is_file() else ""
for token in ["SenderReputation","AbuseReport","QuarantineRecord","ReportAbuse","ReleaseQuarantine","evaluateSpamProtection","recordDeliveryProtection","phishingSignals","spamFingerprint","ErrQuarantineReview","AbuseSpam","AbusePhishing","DuplicateSpamThreshold","PhishingQuarantineScore"]:
    if token not in spam_src: errors.append("MAIL-2.7 spam-protection invariant missing: "+token)
for token in ['"/v1/quarantine"','"/v1/reputation/"','"abuse"',"ReportAbuse","ReleaseQuarantine"]:
    if token not in http: errors.append("MAIL-2.7 HTTP protection surface missing: "+token)
for token in ["ListQuarantine","ReleaseQuarantine","ReportAbuse","GetSenderReputation"]:
    if token not in client: errors.append("MAIL-2.7 client protection surface missing: "+token)
for token in ["evaluateSpamProtection","recordDeliveryProtection","protection.Quarantine","FolderJunk"]:
    if token not in service: errors.append("MAIL-2.7 delivery protection integration missing: "+token)
conversation_src=(ROOT/"mail/conversation.go").read_text() if (ROOT/"mail/conversation.go").is_file() else ""
for token in ["ConversationState","ConversationSummary","ConversationView","ReplyRequest","Reply","ListConversations","GetConversation","UpdateConversation","resolveConversation","deterministicConversationID","conversationIndexKey","validateConversationData","MaxConversationMessages"]:
    if token not in conversation_src: errors.append("MAIL-2.8 conversation invariant missing: "+token)
for token in ['"/v1/conversations"','"reply"',"ListConversations","GetConversation","UpdateConversation"]:
    if token not in http: errors.append("MAIL-2.8 HTTP conversation surface missing: "+token)
for token in ["Reply","ListConversations","GetConversation","UpdateConversation"]:
    if token not in client: errors.append("MAIL-2.8 client conversation surface missing: "+token)
for token in ["ReplyTo","resolveConversation","ConversationStates","threadState.Archived","threadState.Muted"]:
    if token not in service: errors.append("MAIL-2.8 service conversation integration missing: "+token)
for token in ["ConversationStates","ConversationIndex","conversationIndexKey","validateConversationData"]:
    if token not in store: errors.append("MAIL-2.8 durable conversation storage missing: "+token)
draft_src=(ROOT/"mail/draft.go").read_text() if (ROOT/"mail/draft.go").is_file() else ""
for token in ["Draft","DraftView","DraftCreateRequest","DraftSaveRequest","CreateDraft","SaveDraft","GetDraft","ListDrafts","DiscardDraft","ErrDraftConflict","PrivateBlobDeleteStore","deterministicDraftID","validateDraftData","MaxDraftsPerUser"]:
    if token not in draft_src: errors.append("MAIL-2.9 draft invariant missing: "+token)
for token in ['"/v1/drafts"',"CreateDraft","SaveDraft","GetDraft","ListDrafts","DiscardDraft"]:
    if token not in http: errors.append("MAIL-2.9 HTTP draft surface missing: "+token)
for token in ["CreateDraft","SaveDraft","GetDraft","ListDrafts","DiscardDraft"]:
    if token not in client: errors.append("MAIL-2.9 client draft surface missing: "+token)
for token in ["Drafts","validateDraftData"]:
    if token not in store: errors.append("MAIL-2.9 durable draft storage missing: "+token)
delivery_src=(ROOT/"mail/delivery.go").read_text() if (ROOT/"mail/delivery.go").is_file() else ""
for token in ["Delivery","DeliveryQueued","DeliverySending","DeliveryRetrying","DeliveryDelivered","DeliveryFailed","DeliveryCancelled","QueueDelivery","ProcessDelivery","RetryDelivery","CancelDelivery","ListOutbox","GetDelivery","MaxDeliveryAttempts","validateDeliveryData"]:
    if token not in delivery_src: errors.append("MAIL-2.10 delivery queue invariant missing: "+token)
for token in ['"/v1/outbox"',"QueueDelivery","ProcessDelivery","RetryDelivery","CancelDelivery"]:
    if token not in http: errors.append("MAIL-2.10 HTTP outbox surface missing: "+token)
for token in ["QueueDelivery","ListOutbox","GetDelivery","ProcessDelivery","RetryDelivery","CancelDelivery"]:
    if token not in client: errors.append("MAIL-2.10 client outbox surface missing: "+token)
for token in ["Deliveries","validateDeliveryData","DurableStoreSchemaVersion = 8"]:
    if token not in store: errors.append("MAIL-2.10 durable queue storage missing: "+token)
onboarding_src=(ROOT/"mail/onboarding.go").read_text() if (ROOT/"mail/onboarding.go").is_file() else ""
for token in ["OnboardingGoogle","OnboardingApple","OnboardingPasskey","OnboardingExistingWallet","OnboardingAuthority","OnboardingService","GoogleOnboardingRequest","AppleOnboardingRequest","PasskeyOnboardingRequest","WalletOnboardingRequest","SessionToken","NonCustodial","ErrOnboardingInvalidResult","validWalletAddress"]:
    if token not in onboarding_src: errors.append("MAIL-2.11 onboarding invariant missing: "+token)
for token in ['"/v1/onboarding/google"','"/v1/onboarding/apple"','"/v1/onboarding/passkey"','"/v1/onboarding/wallet"',"*OnboardingService"]:
    if token not in http: errors.append("MAIL-2.11 HTTP onboarding surface missing: "+token)
for token in ["GoogleOnboarding","AppleOnboarding","PasskeyOnboarding","ExistingWalletOnboarding"]:
    if token not in client: errors.append("MAIL-2.11 client onboarding surface missing: "+token)
security_src=(ROOT/"mail/security.go").read_text() if (ROOT/"mail/security.go").is_file() else ""
for token in ["SecurityAuthority","SecurityService","SecurityState","PasskeySummary","DeviceSummary","SessionSummary","RecoverySummary","SecurityAlert","EnrollPasskey","RevokePasskey","EnrollDevice","RevokeDevice","RecoverySetAuthority","RecoveryPropose","RecoveryCancel","RecoveryFinalize","RevokeSession","AcknowledgeAlert","ErrSecurityInvalidResult","AuthorizationEpoch"]:
    if token not in security_src: errors.append("MAIL-2.12 security invariant missing: "+token)
for token in ['"/v1/security"','"/v1/security/passkeys"','"/v1/security/devices"','"/v1/security/recovery"','"/v1/security/sessions/"','"/v1/security/alerts/"',"*SecurityService"]:
    if token not in http: errors.append("MAIL-2.12 HTTP security surface missing: "+token)
for token in ["SecurityState","EnrollPasskey","RevokePasskey","EnrollDevice","RevokeDevice","Recovery","RevokeSession","AcknowledgeSecurityAlert"]:
    if token not in client: errors.append("MAIL-2.12 client security surface missing: "+token)
wallet_src=(ROOT/"mail/wallet_actions.go").read_text() if (ROOT/"mail/wallet_actions.go").is_file() else ""
for token in ["WalletActionTransaction","WalletActionMessageSignature","WalletVerifyTransaction","WalletVerifySignature","WalletActionAuthority","WalletActionService","WalletActionRequest","WalletHandoff","WalletVerificationRequest","WalletVerification","PrepareWalletAction","VerifyWalletEvidence","RequiresApproval","NonCustodial","Canonical","Finalized","ErrWalletInvalidResult"]:
    if token not in wallet_src: errors.append("MAIL-2.13 wallet handoff invariant missing: "+token)
for token in ['"/v1/wallet/actions"','"/v1/wallet/verifications"',"*WalletActionService"]:
    if token not in http: errors.append("MAIL-2.13 HTTP wallet surface missing: "+token)
for token in ["PrepareWalletAction","VerifyWalletEvidence"]:
    if token not in client: errors.append("MAIL-2.13 client wallet surface missing: "+token)
web=(ROOT/"mail/web/index.html").read_text() if (ROOT/"mail/web/index.html").is_file() else ""
for token in ["/v1/drafts","autosaveDraft","recoverDraft","discardDraft","expected_version"]:
    if token not in web: errors.append("MAIL-2.9 thin UI draft behavior missing: "+token)
for token in ["/v1/onboarding/","data-onboard","__420_ONBOARDING__","mailSession","non_custodial","session_token"]:
    if token not in web: errors.append("MAIL-2.11 thin UI onboarding behavior missing: "+token)
for token in ["/v1/security","data-security-action","__420_SECURITY__","loadSecurity","revokeSecurity","authorization_epoch"]:
    if token not in web: errors.append("MAIL-2.12 thin UI security behavior missing: "+token)
for token in ["/v1/wallet/actions","/v1/wallet/verifications","data-wallet-action","__420_WALLET_ACTIONS__","requires_wallet_approval","non_custodial"]:
    if token not in web: errors.append("MAIL-2.13 thin UI wallet behavior missing: "+token)


if "body.textContent=d.body" not in web: errors.append("MAIL-2.7 thin UI no longer renders private body as inert text")

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
print("MAIL-2.3 labels and custom folders: qualified by app-scoped checks")
print("MAIL-2.4 private mail search: qualified by app-scoped checks")
print("MAIL-2.5 user filters and rules engine: qualified by app-scoped checks")
print("MAIL-2.6 blocklists allowlists and trust controls: qualified by app-scoped checks")
print("MAIL-2.7 spam junk and phishing protection: qualified by app-scoped checks")
print("MAIL-2.8 threads and conversations: qualified by app-scoped checks")
print("MAIL-2.9 drafts system: qualified by app-scoped checks")
print("MAIL-2.10 outbox and delivery queue: qualified by app-scoped checks")
print("MAIL-2.11 email-as-a-wallet onboarding: qualified by app-scoped checks")
print("MAIL-2.12 passkey-first security: qualified by app-scoped checks")
print("MAIL-2.13 wallet functions inside mail: qualified by app-scoped checks")

