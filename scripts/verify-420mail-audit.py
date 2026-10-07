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
    if store.get("schemaVersion")!=11 or store.get("atomicTransactions") is not True or store.get("restartRecovery") is not True or store.get("migrations") is not True: errors.append("Mail durable store capability drifted")
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
    connectors=profile.get("externalIntegrations",{})
    if connectors.get("enabled") is not True or connectors.get("architecture")!="PROVIDER_NEUTRAL_CONNECTOR_REGISTRY" or connectors.get("providerSpecificLogicInCore") is not False: errors.append("MAIL-2.14 connector architecture drifted")
    if connectors.get("capabilities")!=["LINK","PULL","PUSH","WEBHOOK","WALLET_VERIFY"]: errors.append("MAIL-2.14 connector capability inventory drifted")
    if connectors.get("ownerScopedConnections") is not True or connectors.get("authorizationInput")!="OPAQUE_SECURE_BROKER_REFERENCE_ONLY": errors.append("MAIL-2.14 connector authorization boundary drifted")
    if connectors.get("rawAccessTokenInput") is not False or connectors.get("rawRefreshTokenInput") is not False or connectors.get("rawClientSecretInput") is not False: errors.append("MAIL-2.14 connector raw-secret boundary drifted")
    if connectors.get("webhookAuthentication")!="ADAPTER_VERIFIES_TRANSPORT_HEADERS_AND_PAYLOAD" or connectors.get("webhookSessionAuth") is not False: errors.append("MAIL-2.14 webhook authority boundary drifted")
    if connectors.get("pullCursorOpaque") is not True or connectors.get("pushIdempotencyRequired") is not True or connectors.get("providerIsolation") is not True or connectors.get("capabilityDeclarationRequired") is not True: errors.append("MAIL-2.14 connector lifecycle boundary drifted")
    if connectors.get("credentialPersistence")!="CONNECTOR_ADAPTER_OR_SECURE_BROKER_ONLY" or connectors.get("mailMetadataCredentialPersistence") is not False or connectors.get("publicIndexing") is not False or connectors.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.14 connector persistence/privacy boundary drifted")
    discord=profile.get("discordAccountLinking",{})
    if discord.get("enabled") is not True or discord.get("provider")!="discord" or discord.get("connectorCapability")!="LINK": errors.append("MAIL-2.15 Discord connector boundary drifted")
    if discord.get("authorization")!="OPAQUE_SECURE_BROKER_REFERENCE" or discord.get("requiredScopes")!=["identify"] or discord.get("verifiedProviderIdentityRequired") is not True: errors.append("MAIL-2.15 Discord authorization drifted")
    if discord.get("externalAccountId")!="DISCORD_SNOWFLAKE" or discord.get("ownerBinding")!="AUTHENTICATED_420MAIL_IDENTITY" or discord.get("unlinkSupported") is not True or discord.get("nonCustodial") is not True: errors.append("MAIL-2.15 Discord identity binding drifted")
    if discord.get("rawAccessTokenInput") is not False or discord.get("rawRefreshTokenInput") is not False or discord.get("rawClientSecretInput") is not False: errors.append("MAIL-2.15 Discord raw-secret boundary drifted")
    if discord.get("credentialPersistence")!="DISCORD_AUTHORITY_OR_SECURE_BROKER_ONLY" or discord.get("mailMetadataCredentialPersistence") is not False: errors.append("MAIL-2.15 Discord credential persistence drifted")
    dsync=profile.get("discordSync",{})
    if dsync.get("enabled") is not True or dsync.get("provider")!="discord" or dsync.get("connectorCapability")!="PULL": errors.append("MAIL-2.16 Discord sync capability drifted")
    if dsync.get("authenticatedOwnerOnly") is not True or dsync.get("connectionBinding")!="DISCORD_LINK_CONNECTION_ID" or dsync.get("messageSource")!="discord" or dsync.get("recipientFolder")!="INBOX": errors.append("MAIL-2.16 Discord sync owner/materialization drifted")
    if dsync.get("bodyStorage")!="PRIVATE_OFF_CHAIN_REFERENCE" or dsync.get("externalIdempotency")!="OWNER_CONNECTION_MESSAGE_ID" or dsync.get("cursorPersistence")!="DURABLE_OWNER_CONNECTION_CURSOR" or dsync.get("restartRecovery") is not True: errors.append("MAIL-2.16 Discord sync durability drifted")
    if dsync.get("orderedImport")!="CREATED_AT_ASC_MESSAGE_ID_ASC" or dsync.get("rulesEngineApplied") is not True or dsync.get("trustControlsApplied") is not True or dsync.get("spamProtectionApplied") is not True or dsync.get("mutedAndQuarantinedSuppressNotification") is not True: errors.append("MAIL-2.16 Discord sync mailbox protection drifted")
    if dsync.get("publicIndexing") is not False or dsync.get("messageBodiesOnChain") is not False or dsync.get("delivery") is not False or dsync.get("walletVerification") is not False: errors.append("MAIL-2.16 Discord sync privacy/scope drifted")
    ddelivery=profile.get("discordDelivery",{})
    if ddelivery.get("enabled") is not True or ddelivery.get("provider")!="discord" or ddelivery.get("connectorCapability")!="PUSH": errors.append("MAIL-2.17 Discord delivery capability drifted")
    if ddelivery.get("authenticatedOwnerOnly") is not True or ddelivery.get("connectionBinding")!="DISCORD_LINK_CONNECTION_ID" or ddelivery.get("destination")!="DISCORD_CHANNEL_SNOWFLAKE": errors.append("MAIL-2.17 Discord delivery owner/destination drifted")
    if ddelivery.get("maxContentBytes")!=2000 or ddelivery.get("replyTarget")!="OPTIONAL_DISCORD_MESSAGE_SNOWFLAKE" or ddelivery.get("idempotency")!="REQUIRED_CALLER_KEY_PASSED_TO_PROVIDER_AUTHORITY": errors.append("MAIL-2.17 Discord delivery payload/idempotency drifted")
    if ddelivery.get("providerAuthority")!="DISCORD_DELIVERY_AUTHORITY" or ddelivery.get("rawAccessTokenInput") is not False or ddelivery.get("rawRefreshTokenInput") is not False or ddelivery.get("rawClientSecretInput") is not False: errors.append("MAIL-2.17 Discord delivery authority/secret boundary drifted")
    if ddelivery.get("credentialPersistence")!="DISCORD_AUTHORITY_OR_SECURE_BROKER_ONLY" or ddelivery.get("mailMetadataCredentialPersistence") is not False or ddelivery.get("publicIndexing") is not False or ddelivery.get("messageBodiesOnChain") is not False or ddelivery.get("walletVerification") is not False: errors.append("MAIL-2.17 Discord delivery privacy/scope drifted")
    dwallet=profile.get("discordWalletVerification",{})
    if dwallet.get("enabled") is not True or dwallet.get("provider")!="discord" or dwallet.get("connectorCapability")!="WALLET_VERIFY": errors.append("MAIL-2.18 Discord wallet capability drifted")
    signal=profile.get("signalIntegrationBoundary",{})
    if signal.get("enabled") is not True or signal.get("provider")!="signal" or signal.get("status")!="SHARE_FORWARD_ENABLED": errors.append("MAIL-2.21 Signal boundary identity/status drifted")
    if signal.get("architecture")!="EXTERNAL_SIGNAL_TRANSPORT_ADAPTER" or signal.get("transportAuthority")!="SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY": errors.append("MAIL-2.19 Signal transport authority drifted")
    if signal.get("providerRegistrationAllowed") is not False or signal.get("mailOwnsSignalIdentity") is not False or signal.get("mailStoresProviderSecrets") is not False: errors.append("MAIL-2.19 Signal ownership/registration boundary drifted")
    if signal.get("outboundNotifications") is not True: errors.append("MAIL-2.20 Signal notifications not enabled")
    if signal.get("shareAndForward") is not True: errors.append("MAIL-2.21 Signal share/forward not enabled")
    if any(signal.get(k) is not False for k in ["accountLinking","inboundSync","webhookIngestion","deepSync"]): errors.append("MAIL-2.21 pulled later Signal capabilities forward")
    if signal.get("deepSyncCondition")!="STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED": errors.append("MAIL-2.19 Signal deep-sync gate drifted")
    if any(signal.get(k) is not False for k in ["rawAccessTokenInput","rawRefreshTokenInput","rawClientSecretInput","phoneNumberCredentialInput","verificationCodeInput","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.19 Signal secret/privacy boundary drifted")
    signal_notifications=profile.get("signalNotifications",{})
    if signal_notifications.get("enabled") is not True or signal_notifications.get("provider")!="signal" or signal_notifications.get("transportAuthority")!="SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY": errors.append("MAIL-2.20 Signal notification authority drifted")
    if signal_notifications.get("recipientResolution")!="EXTERNAL_SIGNAL_NOTIFICATION_AUTHORITY" or signal_notifications.get("consentResolution")!="EXTERNAL_SIGNAL_NOTIFICATION_AUTHORITY" or signal_notifications.get("sourceEvent")!="MAIL_NOTIFICATION_SINK": errors.append("MAIL-2.20 Signal notification resolution/source drifted")
    if signal_notifications.get("notificationKind")!="NEW_MAIL" or signal_notifications.get("payloadPolicy")!="MINIMAL_METADATA_ONLY" or signal_notifications.get("title")!="New 420Mail message": errors.append("MAIL-2.20 Signal notification payload drifted")
    if any(signal_notifications.get(k) is not False for k in ["includesMessageBody","includesSubject","includesSender","includesSource"]): errors.append("MAIL-2.20 Signal notification metadata leakage drifted")
    if signal_notifications.get("idempotencyDomain")!="420/MAIL/SIGNAL/NOTIFICATION/V1" or signal_notifications.get("deterministicRecipientMessageBinding") is not True: errors.append("MAIL-2.20 Signal notification idempotency drifted")
    if signal_notifications.get("preserves420Notifications") is not True or signal_notifications.get("consentSuppressionAllowed") is not True or signal_notifications.get("failureBlocksMailDelivery") is not False: errors.append("MAIL-2.20 Signal notification fanout/failure drifted")
    if signal_notifications.get("accountLinkingRequired") is not False or signal_notifications.get("providerRegistrationAllowed") is not False: errors.append("MAIL-2.20 Signal notification boundary drifted")
    if signal_notifications.get("shareAndForward") is not True: errors.append("MAIL-2.21 Signal notification/share boundary drifted")
    if any(signal_notifications.get(k) is not False for k in ["inboundSync","webhookIngestion","deepSync","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.21 pulled later Signal/privacy capabilities forward")
    signal_share=profile.get("signalShareAndForward",{})
    if signal_share.get("enabled") is not True or signal_share.get("provider")!="signal" or signal_share.get("transportAuthority")!="SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY": errors.append("MAIL-2.21 Signal share authority drifted")
    if signal_share.get("sourceAuthorization")!="AUTHENTICATED_OWNER_LIVE_MAILBOX_COPY" or signal_share.get("destinationResolution")!="OPAQUE_DESTINATION_REFERENCE_EXTERNAL_AUTHORITY": errors.append("MAIL-2.21 Signal share authorization/destination drifted")
    if signal_share.get("supportedModes")!=["SHARE","FORWARD"] or signal_share.get("shareIncludesSubject") is not False or signal_share.get("forwardIncludesSubject") is not True or signal_share.get("includesBody") is not True: errors.append("MAIL-2.21 Signal share payload semantics drifted")
    if signal_share.get("includesSender") is not False or signal_share.get("includesSourceApplication") is not False or signal_share.get("optionalNote") is not True or signal_share.get("maxNoteBytes")!=2048 or signal_share.get("maxDestinationRefBytes")!=512: errors.append("MAIL-2.21 Signal share metadata/bounds drifted")
    if signal_share.get("idempotencyRequired") is not True or signal_share.get("providerCredentialInput") is not False or signal_share.get("phoneNumberCredentialInput") is not False: errors.append("MAIL-2.21 Signal share idempotency/credential drifted")
    if signal_share.get("accountLinkingRequired") is not False or signal_share.get("providerRegistrationAllowed") is not False: errors.append("MAIL-2.21 Signal share connector boundary drifted")
    if any(signal_share.get(k) is not False for k in ["inboundSync","webhookIngestion","deepSync","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.21 pulled Signal sync/privacy capabilities forward")
    signal_deep=profile.get("signalDeepSync",{})
    if signal_deep.get("enabled") is not False or signal_deep.get("provider")!="signal" or signal_deep.get("status")!="CONDITION_UNSATISFIED": errors.append("MAIL-2.22 Signal deep-sync gate status drifted")
    if signal_deep.get("condition")!="STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED" or signal_deep.get("supportedSurfaceFound") is not False: errors.append("MAIL-2.22 Signal deep-sync condition drifted")
    if signal_deep.get("missingEvidence")!=["SUPPORTED_SIGNAL_API_OR_CLIENT_CONTRACT","STABLE_INBOUND_SYNC_TRANSPORT","ACCOUNT_OR_DEVICE_BINDING_AUTHORITY","REPLAY_AND_CURSOR_SEMANTICS","PROVIDER_LIFECYCLE_AND_RATE_LIMIT_CONTRACT"]: errors.append("MAIL-2.22 Signal deep-sync missing-evidence inventory drifted")
    if signal_deep.get("inboundSync") is not False or signal_deep.get("webhookIngestion") is not False or signal_deep.get("providerRegistrationAllowed") is not False: errors.append("MAIL-2.22 Signal deep-sync operational capability drifted")
    if signal_deep.get("rawCredentialInput") is not False or signal_deep.get("publicIndexing") is not False or signal_deep.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.22 Signal deep-sync privacy boundary drifted")
    telegram=profile.get("telegramAccountLinking",{})
    if telegram.get("enabled") is not True or telegram.get("provider")!="telegram" or telegram.get("connectorCapability")!="LINK": errors.append("MAIL-2.23 Telegram link capability drifted")
    if telegram.get("authority")!="TELEGRAM_LINK_AUTHORITY" or telegram.get("authorizationRef")!="OPAQUE_EXTERNAL_AUTHORIZATION_REFERENCE" or telegram.get("accountHintAuthoritative") is not False: errors.append("MAIL-2.23 Telegram authority/reference drifted")
    if telegram.get("userIdFormat")!="POSITIVE_DECIMAL_IDENTIFIER" or telegram.get("verifiedAccountRequired") is not True or telegram.get("nonCustodialRequired") is not True or telegram.get("unlinkSupported") is not True: errors.append("MAIL-2.23 Telegram account invariant drifted")
    if telegram.get("pull") is not True: errors.append("MAIL-2.24 Telegram PULL capability not enabled")
    if telegram.get("push") is not True: errors.append("MAIL-2.25 Telegram PUSH capability not enabled")
    if any(telegram.get(k) is not False for k in ["webhook","walletVerification"]): errors.append("MAIL-2.25 pulled later Telegram capabilities forward")
    if any(telegram.get(k) is not False for k in ["rawBotTokenInput","rawAccessTokenInput","rawRefreshTokenInput","rawClientSecretInput","phoneNumberCredentialInput","verificationCodeInput","providerCredentialPersistence","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.23 Telegram credential/privacy boundary drifted")
    telegram_sync=profile.get("telegramSync",{})
    if telegram.get("pull") is not True: errors.append("MAIL-2.24 Telegram PULL capability not enabled")
    if telegram_sync.get("enabled") is not True or telegram_sync.get("provider")!="telegram" or telegram_sync.get("connectorCapability")!="PULL" or telegram_sync.get("authority")!="TELEGRAM_SYNC_AUTHORITY": errors.append("MAIL-2.24 Telegram sync authority/capability drifted")
    if telegram_sync.get("requiresLinkedTelegramAccount") is not True or telegram_sync.get("connectionIdFormat")!="telegram:{user-id}": errors.append("MAIL-2.24 Telegram sync connection boundary drifted")
    if telegram_sync.get("cursorStorage")!="DURABLE_MAIL_STORE_SCHEMA_V11" or telegram_sync.get("restartRecovery") is not True or telegram_sync.get("cursorBoundTo")!=["MAIL_IDENTITY","TELEGRAM_CONNECTION_ID"] or telegram_sync.get("maxCursorBytes")!=65536: errors.append("MAIL-2.24 Telegram cursor durability drifted")
    if telegram_sync.get("itemKind")!="TELEGRAM_MESSAGE" or telegram_sync.get("messageIdFormat")!="POSITIVE_DECIMAL_IDENTIFIER" or telegram_sync.get("authorIdFormat")!="POSITIVE_DECIMAL_IDENTIFIER" or telegram_sync.get("chatIdFormat")!="SIGNED_DECIMAL_IDENTIFIER": errors.append("MAIL-2.24 Telegram item identity drifted")
    if telegram_sync.get("privateBodyStorage") is not True or telegram_sync.get("mailboxMaterialization")!="RECIPIENT_INBOX" or telegram_sync.get("source")!="telegram" or telegram_sync.get("visibility")!="PRIVATE": errors.append("MAIL-2.24 Telegram materialization/privacy drifted")
    if any(telegram_sync.get(k) is not True for k in ["deterministicMessageId","deterministicConversationId","idempotentReplay","mutationConflictRejected","permanentDeleteReplayDoesNotResurrect","trustRulesApplied","spamProtectionApplied","notificationsApplied"]): errors.append("MAIL-2.24 Telegram replay/policy invariant drifted")
    if telegram_sync.get("push") is not True: errors.append("MAIL-2.25 Telegram sync/delivery capability drifted")
    if any(telegram_sync.get(k) is not False for k in ["webhook","walletVerification","rawBotTokenInput","rawAccessTokenInput","rawRefreshTokenInput","rawClientSecretInput","phoneNumberCredentialInput","verificationCodeInput","providerCredentialPersistence","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.25 pulled later Telegram/privacy capabilities forward")
    telegram_delivery=profile.get("telegramDelivery",{})
    if telegram_delivery.get("enabled") is not True or telegram_delivery.get("provider")!="telegram" or telegram_delivery.get("connectorCapability")!="PUSH" or telegram_delivery.get("authority")!="TELEGRAM_DELIVERY_AUTHORITY": errors.append("MAIL-2.25 Telegram delivery authority/capability drifted")
    if telegram_delivery.get("requiresLinkedTelegramAccount") is not True or telegram_delivery.get("connectionIdFormat")!="telegram:{user-id}" or telegram_delivery.get("chatIdFormat")!="SIGNED_DECIMAL_IDENTIFIER": errors.append("MAIL-2.25 Telegram delivery connection/chat drifted")
    if telegram_delivery.get("maxContentBytes")!=4096 or telegram_delivery.get("idempotencyRequired") is not True or telegram_delivery.get("receiptMessageIdRequired") is not True or telegram_delivery.get("receiptChatMatchRequired") is not True or telegram_delivery.get("acceptedTimestampRequired") is not True: errors.append("MAIL-2.25 Telegram delivery receipt/idempotency drifted")
    if any(telegram_delivery.get(k) is not False for k in ["webhook","walletVerification","rawBotTokenInput","rawAccessTokenInput","rawRefreshTokenInput","rawClientSecretInput","phoneNumberCredentialInput","verificationCodeInput","providerCredentialPersistence","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.25 Telegram delivery credential/privacy drifted")
    unified_inbox=profile.get("unifiedIntegrationsInbox",{})
    if unified_inbox.get("enabled") is not True or unified_inbox.get("endpoint")!="/v1/integrations/inbox" or unified_inbox.get("authenticatedOwnerOnly") is not True: errors.append("MAIL-2.26 unified integrations inbox access drifted")
    if unified_inbox.get("canonicalMailboxView") is not True or unified_inbox.get("duplicateStore") is not False or unified_inbox.get("folder")!="INBOX": errors.append("MAIL-2.26 unified inbox canonical-state drifted")
    if unified_inbox.get("sources")!=["discord","telegram"] or unified_inbox.get("preserveMailboxState") is not True: errors.append("MAIL-2.26 unified inbox source/state drifted")
    if any(unified_inbox.get(k) is not False for k in ["includeDeleted","includeArchived","includeJunk","includeNative420Mail","privateBodiesInline","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.26 unified inbox scope/privacy drifted")
    if unified_inbox.get("deterministicOrdering")!="CREATED_AT_DESC_MESSAGE_ID_ASC" or unified_inbox.get("cursorPagination") is not True: errors.append("MAIL-2.26 unified inbox ordering drifted")
    if unified_inbox.get("sourceFilter") is not True or unified_inbox.get("sourceFilterParameter")!="source" or unified_inbox.get("sourceFilterValues")!=["discord","telegram"]: errors.append("MAIL-2.28 integration-specific source filter drifted")
    if unified_inbox.get("filterBeforePagination") is not True or unified_inbox.get("unsupportedSourceRejected") is not True: errors.append("MAIL-2.28 integration filter pagination/validation drifted")
    cross_identity=profile.get("crossPlatformVerifiedIdentity",{})
    if cross_identity.get("enabled") is not True or cross_identity.get("endpoint")!="/v1/integrations/identity" or cross_identity.get("authenticatedOwnerOnly") is not True or cross_identity.get("rootIdentity")!="420MAIL_IDENTITY": errors.append("MAIL-2.27 cross-platform identity access/root drifted")
    if cross_identity.get("evidenceSources")!={"discord":["PROVIDER_AUTHORITY_VERIFIED","WALLET_VERIFIED"],"telegram":["PROVIDER_AUTHORITY_VERIFIED"]}: errors.append("MAIL-2.27 cross-platform identity evidence drifted")
    if cross_identity.get("assurancePrecedence")!=["WALLET_VERIFIED","PROVIDER_AUTHORITY_VERIFIED"] or cross_identity.get("walletProofProvider")!="discord": errors.append("MAIL-2.27 assurance precedence drifted")
    if cross_identity.get("telegramWalletVerification") is not False or cross_identity.get("signalIncluded") is not False or cross_identity.get("signalExclusionReason")!="DEEP_SYNC_CONDITION_UNSATISFIED": errors.append("MAIL-2.27 provider verification boundary drifted")
    if any(cross_identity.get(k) is not True for k in ["durableEvidenceOnly","unverifiedStatesExcluded","foreignOwnerStatesExcluded"]): errors.append("MAIL-2.27 evidence isolation drifted")
    if cross_identity.get("deterministicOrdering")!="PROVIDER_ASC_CONNECTION_ID_ASC" or any(cross_identity.get(k) is not False for k in ["rawCredentialInput","privateKeyInput","seedPhraseInput","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.27 privacy/ordering drifted")
    notification_routing=profile.get("unifiedNotificationRouting",{})
    if notification_routing.get("enabled") is not True or notification_routing.get("sourceEvent")!="MAIL_NOTIFICATION_SINK": errors.append("MAIL-2.29 unified notification router source drifted")
    if notification_routing.get("qualifiedRoutes")!=["420notifications","signal"] or notification_routing.get("deterministicOrder")!=["420notifications","signal"]: errors.append("MAIL-2.29 qualified notification routes/order drifted")
    if any(notification_routing.get(k) is not True for k in ["attemptAllQualifiedRoutes","routeFailureIsolation","mutedRecipientSuppressesAllRoutes","quarantineSuppressesAllRoutes"]): errors.append("MAIL-2.29 notification fanout/suppression drifted")
    if any(notification_routing.get(k) is not False for k in ["failureBlocksMailDelivery","idempotentMailReplayRenotifies","discordNotificationTransport","telegramNotificationTransport","signalDeepSyncRequired","privateMessageBodyIncluded","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.29 notification scope/privacy drifted")
    if notification_routing.get("discordTelegramReason")!="EXPLICIT_MESSAGE_DELIVERY_IS_NOT_NOTIFICATION_ROUTING": errors.append("MAIL-2.29 Discord/Telegram notification boundary drifted")
    desktop_ui=profile.get("desktopMailUI",{})
    if desktop_ui.get("enabled") is not True or desktop_ui.get("entrypoint")!="mail/web/index.html" or desktop_ui.get("layout")!="THREE_PANE_DESKTOP_WITH_RESPONSIVE_FALLBACK": errors.append("MAIL-2.30 desktop shell config drifted")
    if desktop_ui.get("mailboxes")!=["INBOX","SENT","DRAFTS","OUTBOX","ARCHIVE","JUNK","TRASH"]: errors.append("MAIL-2.30 desktop mailbox coverage drifted")
    if desktop_ui.get("smartViews")!=["UNREAD","STARRED","CONVERSATIONS","INTEGRATIONS"] or any(desktop_ui.get(k) is not True for k in ["privateSearch","labels","customFolders","draftAutosave","outboxLifecycle","externalIntegrationsSurface","securityHandoffSurface","walletHandoffSurface"]): errors.append("MAIL-2.30 desktop feature coverage drifted")
    if desktop_ui.get("messageBodyRendering")!="INERT_TEXT_CONTENT" or desktop_ui.get("settingsCenter") is not True: errors.append("MAIL-2.31 desktop settings integration drifted")
    if desktop_ui.get("settingsCenterDomains")!=["TRUST_POLICY","TRUST_ENTRIES","MAIL_RULES","LABELS","CUSTOM_FOLDERS","SECURITY_HANDOFF","CONNECTOR_HANDOFF","WALLET_HANDOFF"] or desktop_ui.get("settingsOwnerScoped") is not True or desktop_ui.get("settingsUsesExistingAuthorities") is not True or desktop_ui.get("rawSecretFields") is not False: errors.append("MAIL-2.31 desktop settings authority drifted")
    mail_settings=profile.get("mailSettingsCenter",{})
    if mail_settings.get("enabled") is not True or mail_settings.get("authenticatedOwnerOnly") is not True: errors.append("MAIL-2.31 settings access drifted")
    if [mail_settings.get(k) for k in ["trustPolicyEndpoint","trustEntriesEndpoint","rulesEndpoint","labelsEndpoint","customFoldersEndpoint"]]!=["/v1/trust/settings","/v1/trust/entries","/v1/rules","/v1/labels","/v1/custom-folders"]: errors.append("MAIL-2.31 settings endpoint drifted")
    if mail_settings.get("ruleConditionAuthority")!=["sender_equals","content_contains","source_equals"] or mail_settings.get("ruleActionFolders")!=["INBOX","ARCHIVE","JUNK","TRASH"]: errors.append("MAIL-2.31 rule settings authority drifted")
    if mail_settings.get("trustKinds")!=["IDENTITY","PHRASE","APPLICATION"] or mail_settings.get("trustDispositions")!=["BLOCK","ALLOW","MUTE"]: errors.append("MAIL-2.31 trust settings authority drifted")
    if any(mail_settings.get(k) is not True for k in ["securityUsesExistingHandoff","integrationsUseExistingHandoff","walletUsesExistingHandoff","systemLabelsImmutable"]): errors.append("MAIL-2.31 settings handoff/system-label drifted")
    if any(mail_settings.get(k) is not False for k in ["providerCredentialsAccepted","walletSecretsAccepted","newSettingsAuthority","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.31 settings secret/privacy drifted")
    connector_isolation=profile.get("connectorIsolation",{})
    if connector_isolation.get("enabled") is not True or any(connector_isolation.get(k) is not True for k in ["registryDescriptorSnapshot","postRegistrationCapabilityMutationRejected","postRegistrationProviderMutationRejected","descriptorCopiesReturned","adapterPanicContained","webhookHeaderMapCopied","capabilityCheckedBeforeAdapterCall","providerResultBindingRequired","identityResultBindingRequired","connectionResultBindingRequired","unsupportedCapabilityFailsClosed","providerFailureHasNoFallback"]): errors.append("MAIL-2.32 connector isolation contract drifted")
    if any(connector_isolation.get(k) is not False for k in ["rawProviderCredentialPersistence","crossProviderAuthorityEscalation","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.32 connector isolation privacy/authority drifted")
    leakage=profile.get("encryptionLeakageControls",{})
    if leakage.get("enabled") is not True or any(leakage.get(k) is not True for k in ["durableBlobSecurityAttestationRequired","encryptedAtRestRequired","externalKeyCustodyRequired","ownerScopedBlobAccessRequired","sha256ContentIntegrityRequired","verifyDigestOnWrite","verifyDigestOnRead"]): errors.append("MAIL-2.33 encryption/integrity contract drifted")
    if leakage.get("httpRedactedFields")!=["body_ref","body_digest","staging_body_ref","staging_body_digest","request_fingerprint","idempotency_key"]: errors.append("MAIL-2.33 HTTP redaction inventory drifted")
    if any(leakage.get(k) is not False for k in ["privateBodyPlaintextInMetadata","privateBodyPlaintextInSearchResults","privateStorageLocatorInHTTP","privateStorageDigestInHTTP","providerSecretsInMailMetadata","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.33 leakage/privacy boundary drifted")
    impersonation=profile.get("phishingImpersonationProtection",{})
    if impersonation.get("enabled") is not True or impersonation.get("protectedIdentitySkeletons")!=["420integrated","420mail","420wallet","420identity","420support","420security","420admin"]: errors.append("MAIL-2.34 protected identity inventory drifted")
    if impersonation.get("externalDisplayNameProviders")!=["discord","telegram"] or impersonation.get("officialDomain")!="420integrated.org" or impersonation.get("lookalikeDomainQuarantineScore")!=3: errors.append("MAIL-2.34 provider/domain policy drifted")
    if any(impersonation.get(k) is not True for k in ["protectedExternalDisplayClaimQuarantined","confusableProtectedDisplayClaimDetected","ecosystemDomainLookalikeDetection","officialSubdomainsAllowed","canonicalNativeSenderAuthorityPreserved","quarantineSuppressesNotification"]): errors.append("MAIL-2.34 impersonation controls drifted")
    if impersonation.get("trustedSenderBypassesImpersonation") is not False or impersonation.get("quarantineFolder")!="JUNK" or impersonation.get("publicIndexing") is not False or impersonation.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.34 impersonation quarantine/privacy drifted")
    abuse_controls=profile.get("abuseControls",{})
    if abuse_controls.get("enabled") is not True or abuse_controls.get("nativeSenderMessagesPerMinute")!=60 or abuse_controls.get("nativeSenderDistinctRecipientsPerHour")!=25: errors.append("MAIL-2.35 native abuse-rate policy drifted")
    if abuse_controls.get("connectorMaxItemsPerResult")!=500 or abuse_controls.get("rateLimitHTTPStatus")!=429: errors.append("MAIL-2.35 connector/HTTP abuse policy drifted")
    if any(abuse_controls.get(k) is not True for k in ["transactionalRecheckBeforeMetadataCommit","connectorPullAndWebhookItemBound","existingOwnerScopedReputationPreserved","existingOneReportPerOwnerMessagePreserved","existingQuarantineReviewPreserved"]): errors.append("MAIL-2.35 abuse-control behavior drifted")
    if any(abuse_controls.get(k) is not False for k in ["idempotentReplayConsumesAdditionalQuota","globalSenderBlacklistFromAutomaticSignal","publicIndexing","messageBodiesOnChain"]): errors.append("MAIL-2.35 abuse-control safety/privacy drifted")
    if desktop_ui.get("newBackendAuthority") is not False or desktop_ui.get("publicIndexing") is not False or desktop_ui.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.30 desktop authority/privacy drifted")
    if dwallet.get("authenticatedOwnerOnly") is not True or dwallet.get("connectionBinding")!="DISCORD_LINK_CONNECTION_ID" or dwallet.get("authority")!="CANONICAL_WALLET_RPC_IDENTITY_ADAPTER": errors.append("MAIL-2.18 Discord wallet authority/binding drifted")
    if dwallet.get("challengeKind")!="MESSAGE_SIGNATURE" or dwallet.get("challengeDomain")!="420/MAIL/DISCORD/WALLET-VERIFY/V1" or dwallet.get("maxChallengeTtlSeconds")!=600: errors.append("MAIL-2.18 Discord wallet challenge drifted")
    if dwallet.get("challengeBindings")!=["MAIL_IDENTITY","DISCORD_CONNECTION","DISCORD_USER_ID","CHAIN_ID","WALLET_ACCOUNT","EXPIRY"]: errors.append("MAIL-2.18 Discord wallet challenge bindings drifted")
    if dwallet.get("durableChallengeState") is not True or dwallet.get("restartRecovery") is not True or dwallet.get("canonicalEvidenceRequired") is not True or dwallet.get("nonCustodialRequired") is not True or dwallet.get("replaySafeAfterSuccess") is not True: errors.append("MAIL-2.18 Discord wallet lifecycle drifted")
    if dwallet.get("crossIdentityRejected") is not True or dwallet.get("crossConnectionRejected") is not True or dwallet.get("accountSubstitutionRejected") is not True: errors.append("MAIL-2.18 Discord wallet isolation drifted")
    if dwallet.get("privateKeyInput") is not False or dwallet.get("seedPhraseInput") is not False or dwallet.get("passkeyPrivateMaterialInput") is not False or dwallet.get("providerCredentialInput") is not False or dwallet.get("verificationEvidencePersistence") is not False or dwallet.get("publicIndexing") is not False or dwallet.get("messageBodiesOnChain") is not False: errors.append("MAIL-2.18 Discord wallet secret/privacy drifted")
    if discord.get("webhook") is not False: errors.append("MAIL-2.15 pulled Discord webhook capability forward")
if readiness_path.is_file():
    readiness=json.loads(readiness_path.read_text())
    for key in ("liveTestnetEvidence","genesisCatalogPromoted","genesisCloseout","productionReady"):
        if readiness.get(key) is not False: errors.append(f"readiness overclaims {key}")
    if readiness.get("schema")!="420-mail-readiness-v1" or readiness.get("application")!="420Mail" or readiness.get("serviceId")!="420/service/mail/v1":
        errors.append("MAIL-2.36 readiness identity drifted")
    if readiness.get("contractsRequired") is not False or readiness.get("deployment_status")!="PENDING_PUBLIC_TESTNET":
        errors.append("MAIL-2.36 readiness deployment boundary drifted")
    audit=readiness.get("current_audit",{})
    if audit.get("testnet_roadmap")!="docs/ROADMAP.md" or audit.get("next_step")!="MAIL-AUDIT-7":
        errors.append("MAIL-2.36 readiness handoff drifted")
    blockers=audit.get("blockers",[])
    for required in ["real 420Identity authentication/resolution adapter is not yet wired to a deployed service","real 420Messenger block/messaging policy adapter is not yet wired to a deployed service","real 420Storage private encrypted blob provider is not yet selected and qualified","real 420Notifications delivery adapter is not yet wired and qualified","420Mail is not in the frozen config/genesis-applications.json catalog; promotion requires an explicit catalog decision"]:
        if required not in blockers: errors.append("MAIL-2.36 readiness blocker missing: "+required)
roadmap_path=require("docs/420MAIL-PHASE2-ROADMAP.md")
global_roadmap_path=require("docs/ROADMAP.md")
workflow_path=require(".github/workflows/420mail-audit.yml")
if roadmap_path.is_file():
    phase2_roadmap=roadmap_path.read_text()
    for token in ["MAIL-2.36 — Repository Qualification","MAIL-2.37 — Live Testnet Integration","MAIL-2.38 — Security & Operations Qualification","MAIL-2.39 — Genesis Catalog Decision","MAIL-2.40 — Production Release","Phase closeout"]:
        if token not in phase2_roadmap: errors.append("MAIL-2.36 phase-closeout roadmap definition missing: "+token)
if global_roadmap_path.is_file():
    global_roadmap=global_roadmap_path.read_text()
    for token in ["420Mail — MAIL-2 / MAIL-AUDIT testnet handoff","MAIL-2.37 through MAIL-2.40","MAIL-AUDIT-7 through MAIL-AUDIT-10","mail.external_smtp=false"]:
        if token not in global_roadmap: errors.append("MAIL-2.36 global testnet handoff missing: "+token)
if workflow_path.is_file():
    mail_workflow=workflow_path.read_text()
    for token in ["go test ./mail/...","go test -race ./mail/...","go vet ./mail/...","python3 scripts/verify-420mail-audit.py","test \"$(git rev-parse HEAD)\" = \"${GITHUB_SHA}\""]:
        if token not in mail_workflow: errors.append("MAIL-2.36 qualification workflow invariant missing: "+token)
    for path_token in ["mail/**","config/420mail-service-v1.json","config/genesis-consumer-services.json","config/genesis-applications.json","docs/420MAIL.md","docs/420MAIL-PHASE2-ROADMAP.md","scripts/verify-420mail-audit.py","testnet/public-services/mail/readiness.json"]:
        if path_token not in mail_workflow: errors.append("MAIL-2.36 workflow trigger coverage missing: "+path_token)
service=(ROOT/"mail/service.go").read_text() if (ROOT/"mail/service.go").is_file() else ""
http=(ROOT/"mail/http.go").read_text() if (ROOT/"mail/http.go").is_file() else ""
connector_src=(ROOT/"mail/integrations.go").read_text() if (ROOT/"mail/integrations.go").is_file() else ""
for token in ['ServiceID       = "420/service/mail/v1"',"MaxBodyBytes","IdempotencyKey","Messenger.CanMessage","putPrivateVerified",'Visibility: "PRIVATE"',"ErrIdempotencyConflict", "req.Source != ServiceID","FolderInbox","FolderSent","FolderOutbox","FolderDrafts","FolderArchive","FolderJunk","FolderTrash","MailboxState","PreviousFolder","DeletedAt","PermanentlyDelete","RestoreFromTrash","canMoveMailbox"]:
    if token not in service: errors.append("mail service invariant missing: "+token)
for token in ["PrivateBlobSecurityProfile","PrivateBlobSecurityProvider","validatePrivateBlobSecurity","putPrivateVerified","getPrivateVerified","privateBodyDigest","ErrPrivateBlobIntegrity","ErrPrivateBlobSecurity"]:
    if token not in service: errors.append("MAIL-2.33 private blob security invariant missing: "+token)
for token in ["MaxOutboundMessagesPerMinute","MaxDistinctRecipientsPerHour","checkOutboundAbuseControls","ErrAbuseRateLimited"]:
    if token not in service: errors.append("MAIL-2.35 native abuse-control invariant missing: "+token)
for token in ["MaxConnectorItems","len(items) > MaxConnectorItems"]:
    if token not in connector_src: errors.append("MAIL-2.35 connector batch abuse-control invariant missing: "+token)
for token in ["http.StatusTooManyRequests",'"RATE_LIMITED"',"ErrAbuseRateLimited"]:
    if token not in http: errors.append("MAIL-2.35 HTTP rate-limit surface missing: "+token)
for token in ["sanitizeHTTPJSON","stripPrivateHTTPMetadata","httpPrivateMetadataKeys",'"body_ref"','"body_digest"','"staging_body_ref"','"staging_body_digest"','"request_fingerprint"','"idempotency_key"']:
    if token not in http: errors.append("MAIL-2.33 HTTP leakage control missing: "+token)
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
for token in ["SearchRequest","SearchResult","SearchMailbox","MaxSearchQueryBytes","MaxSearchScanItems","getPrivateVerified","state.Owner != actor","state.DeletedAt != nil"]:
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
for token in ["applyExternalImpersonationSignals","protectedIdentitySkeletons","impersonationSkeleton","asciiIdentitySkeleton","isProtectedDomainLookalike","EXTERNAL_PROTECTED_IDENTITY_CLAIM","CONFUSABLE_PROTECTED_IDENTITY_CLAIM","LOOKALIKE_ECOSYSTEM_DOMAIN"]:
    if token not in spam_src: errors.append("MAIL-2.34 impersonation invariant missing: "+token)
discord_sync_src=(ROOT/"mail/discord_sync.go").read_text() if (ROOT/"mail/discord_sync.go").is_file() else ""
telegram_sync_src=(ROOT/"mail/telegram_sync.go").read_text() if (ROOT/"mail/telegram_sync.go").is_file() else ""
for token in ["applyExternalImpersonationSignals(protection, DiscordProvider, external.AuthorUsername)","putPrivateVerified"]:
    if token not in discord_sync_src: errors.append("MAIL-2.34 Discord impersonation/integrity integration missing: "+token)
for token in ["applyExternalImpersonationSignals(protection, TelegramProvider, external.AuthorUsername)","putPrivateVerified"]:
    if token not in telegram_sync_src: errors.append("MAIL-2.34 Telegram impersonation/integrity integration missing: "+token)
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
for token in ["Deliveries","validateDeliveryData","DiscordSync","validateDiscordSyncData","TelegramSync","validateTelegramSyncData","DiscordWalletVerifications","validateDiscordWalletVerificationData","DurableStoreSchemaVersion = 11"]:
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
for token in ["ConnectorRegistry","ConnectorService","ConnectorAdapter","ConnectorDescriptor","ConnectorCapabilityLink","ConnectorCapabilityPull","ConnectorCapabilityPush","ConnectorCapabilityWebhook","ConnectorCapabilityWalletVerify","ConnectorLinkRequest","ConnectorConnection","ConnectorPullRequest","ConnectorPushRequest","ConnectorWebhookRequest","ErrConnectorNotFound","ErrConnectorUnsupported","ErrConnectorInvalidResult","ErrConnectorConflict"]:
    if token not in connector_src: errors.append("MAIL-2.14 connector invariant missing: "+token)
for token in ["connectorRegistration","cloneConnectorDescriptor","cloneStringMap","ErrConnectorIsolated","isolatedConnectorLink","isolatedConnectorUnlink","isolatedConnectorPull","isolatedConnectorPush","isolatedConnectorWebhook","connectorPanicError"]:
    if token not in connector_src: errors.append("MAIL-2.32 connector isolation invariant missing: "+token)
if "adapter.Descriptor()" in connector_src[connector_src.find("func (r *ConnectorRegistry) Descriptors"):connector_src.find("type ConnectorService")]:
    errors.append("MAIL-2.32 registry still re-reads mutable adapter descriptors after registration")
for token in ['"/v1/connectors/providers"','"/v1/connectors/link"','"/v1/connectors/unlink"','"/v1/connectors/pull"','"/v1/connectors/push"','"/v1/connectors/webhooks/"',"*ConnectorService"]:
    if token not in http: errors.append("MAIL-2.14 HTTP connector surface missing: "+token)
for token in ["ConnectorProviders","LinkConnector","UnlinkConnector","PullConnector","PushConnector"]:
    if token not in client: errors.append("MAIL-2.14 client connector surface missing: "+token)
discord_src=(ROOT/"mail/discord_link.go").read_text() if (ROOT/"mail/discord_link.go").is_file() else ""
discord_sync_src=(ROOT/"mail/discord_sync.go").read_text() if (ROOT/"mail/discord_sync.go").is_file() else ""
discord_delivery_src=(ROOT/"mail/discord_delivery.go").read_text() if (ROOT/"mail/discord_delivery.go").is_file() else ""
discord_wallet_src=(ROOT/"mail/discord_wallet.go").read_text() if (ROOT/"mail/discord_wallet.go").is_file() else ""
signal_boundary_src=(ROOT/"mail/signal_boundary.go").read_text() if (ROOT/"mail/signal_boundary.go").is_file() else ""
signal_notifications_src=(ROOT/"mail/signal_notifications.go").read_text() if (ROOT/"mail/signal_notifications.go").is_file() else ""
signal_share_src=(ROOT/"mail/signal_share.go").read_text() if (ROOT/"mail/signal_share.go").is_file() else ""
signal_deep_sync_gate_src=(ROOT/"mail/signal_deep_sync_gate.go").read_text() if (ROOT/"mail/signal_deep_sync_gate.go").is_file() else ""
telegram_link_src=(ROOT/"mail/telegram_link.go").read_text() if (ROOT/"mail/telegram_link.go").is_file() else ""
telegram_sync_src=(ROOT/"mail/telegram_sync.go").read_text() if (ROOT/"mail/telegram_sync.go").is_file() else ""
telegram_delivery_src=(ROOT/"mail/telegram_delivery.go").read_text() if (ROOT/"mail/telegram_delivery.go").is_file() else ""
integrations_inbox_src=(ROOT/"mail/integrations_inbox.go").read_text() if (ROOT/"mail/integrations_inbox.go").is_file() else ""
cross_platform_identity_src=(ROOT/"mail/cross_platform_identity.go").read_text() if (ROOT/"mail/cross_platform_identity.go").is_file() else ""
notification_routing_src=(ROOT/"mail/notification_routing.go").read_text() if (ROOT/"mail/notification_routing.go").is_file() else ""
for token in ["DiscordProvider","DiscordAccount","DiscordLinkAuthority","DiscordConnectorAdapter","NewDiscordConnectorService","ConnectorCapabilityLink","validDiscordSnowflake","discordUserIDFromConnectionID","ErrDiscordInvalidResult"]:
    if token not in discord_src: errors.append("MAIL-2.15 Discord link invariant missing: "+token)
for token in ["DiscordInboundMessage","DiscordSyncAuthority","DiscordSyncState","DiscordSyncResult","DiscordSyncService","NewDiscordSyncService","ErrDiscordSyncConflict","deterministicDiscordConversationID","discordSyncFingerprint","validateDiscordSyncData"]:
    if token not in discord_sync_src: errors.append("MAIL-2.16 Discord sync invariant missing: "+token)
for token in ["DiscordDeliveryKind","DiscordDeliveryMessage","DiscordDeliveryReceipt","DiscordDeliveryAuthority","DiscordDeliveryRequest","DiscordDeliveryResult","DiscordDeliveryService","NewDiscordDeliveryService","MaxDiscordDeliveryContentBytes","validateDiscordDeliveryMessage"]:
    if token not in discord_delivery_src: errors.append("MAIL-2.17 Discord delivery invariant missing: "+token)
for token in ["DiscordWalletChallengeRequest","DiscordWalletChallenge","DiscordWalletVerificationRequest","DiscordWalletVerification","DiscordWalletVerificationState","DiscordWalletVerificationService","NewDiscordWalletVerificationService","discordWalletChallengeDigest","validateDiscordWalletVerificationData","ErrDiscordWalletConflict"]:
    if token not in discord_wallet_src: errors.append("MAIL-2.18 Discord wallet invariant missing: "+token)
for token in ["SignalProvider","SignalIntegrationBoundary","CanonicalSignalIntegrationBoundary","validateSignalIntegrationBoundary","SHARE_FORWARD_ENABLED","STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED"]:
    if token not in signal_boundary_src: errors.append("MAIL-2.21 Signal boundary invariant missing: "+token)
for token in ["SignalNotificationKind","SignalNotificationRequest","SignalNotificationReceipt","SignalNotificationAuthority","SignalNotificationService","SignalNotificationSink","NewSignalNotificationService","NewSignalNotificationSink","signalNotificationIdempotencyKey","ErrSignalNotificationInvalidResult"]:
    if token not in signal_notifications_src: errors.append("MAIL-2.20 Signal notification invariant missing: "+token)
for token in ["SignalShareMode","SignalShareModeShare","SignalShareModeForward","SignalShareRequest","SignalSharePayload","SignalShareReceipt","SignalShareAuthority","SignalShareService","NewSignalShareService","ErrSignalShareInvalidResult"]:
    if token not in signal_share_src: errors.append("MAIL-2.21 Signal share invariant missing: "+token)
for token in ["SignalDeepSyncStatus","CanonicalSignalDeepSyncStatus","validateSignalDeepSyncStatus","CONDITION_UNSATISFIED","STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED","SUPPORTED_SIGNAL_API_OR_CLIENT_CONTRACT","STABLE_INBOUND_SYNC_TRANSPORT","ACCOUNT_OR_DEVICE_BINDING_AUTHORITY","REPLAY_AND_CURSOR_SEMANTICS","PROVIDER_LIFECYCLE_AND_RATE_LIMIT_CONTRACT"]:
    if token not in signal_deep_sync_gate_src: errors.append("MAIL-2.22 Signal deep-sync gate invariant missing: "+token)
for token in ["TelegramProvider","TelegramAccount","TelegramLinkAuthority","TelegramConnectorAdapter","NewTelegramConnectorService","ConnectorCapabilityLink","validTelegramUserID","telegramUserIDFromConnectionID","telegramDisplayName","ErrTelegramInvalidResult"]:
    if token not in telegram_link_src: errors.append("MAIL-2.23 Telegram link invariant missing: "+token)
for token in ["TelegramInboundMessage","TelegramSyncPage","TelegramSyncAuthority","TelegramSyncState","TelegramSyncResult","TelegramSyncService","NewTelegramSyncService","TelegramSyncItemKind","ErrTelegramSyncConflict","telegramSyncFingerprint","deterministicTelegramConversationID","validateTelegramSyncData","validTelegramChatID"]:
    if token not in telegram_sync_src: errors.append("MAIL-2.24 Telegram sync invariant missing: "+token)
for token in ["TelegramDeliveryKind","TelegramDeliveryMessage","TelegramDeliveryReceipt","TelegramDeliveryAuthority","TelegramDeliveryRequest","TelegramDeliveryResult","TelegramDeliveryService","NewTelegramDeliveryService","MaxTelegramDeliveryContentBytes","validateTelegramDeliveryMessage"]:
    if token not in telegram_delivery_src: errors.append("MAIL-2.25 Telegram delivery invariant missing: "+token)
for token in ["IntegrationsInboxPage","IntegrationsInbox","isIntegrationInboxSource","FolderInbox","DiscordProvider","TelegramProvider","decodeCursor","encodeCursor"]:
    if token not in integrations_inbox_src: errors.append("MAIL-2.26 unified integrations inbox invariant missing: "+token)
for token in ["IntegrationInboxFilter","IntegrationsInboxFiltered","normalizeIntegrationInboxFilter","filter.Source"]:
    if token not in integrations_inbox_src: errors.append("MAIL-2.28 integration-specific filter invariant missing: "+token)
for token in ["VerifiedIdentityAssurance","VerifiedIdentityProviderAuthority","VerifiedIdentityWallet","VerifiedPlatformIdentity","CrossPlatformVerifiedIdentity","CrossPlatformIdentity","DiscordWalletVerifications","DiscordSync","TelegramSync"]:
    if token not in cross_platform_identity_src: errors.append("MAIL-2.27 cross-platform identity invariant missing: "+token)
for token in ["UnifiedNotificationRouter","NewUnifiedNotificationRouter","NotificationRoute420Notifications","NotificationRouteSignal","NotificationRoutingError","route.NotifyMail","Routes"]:
    if token not in notification_routing_src: errors.append("MAIL-2.29 unified notification routing invariant missing: "+token)
for token in ["UnifiedNotificationRouter","NewUnifiedNotificationRouter"]:
    if token not in signal_notifications_src: errors.append("MAIL-2.29 Signal compatibility router integration missing: "+token)
for token in ["TelegramDeliveryAuthority","ConnectorCapabilityPush","DeliverTelegram","TelegramDeliveryKind"]:
    if token not in telegram_link_src: errors.append("MAIL-2.25 Telegram adapter delivery invariant missing: "+token)
for token in ["TelegramSyncAuthority","ConnectorCapabilityPull","PullTelegram","TelegramSyncItemKind"]:
    if token not in telegram_link_src: errors.append("MAIL-2.24 Telegram adapter sync invariant missing: "+token)
for forbidden in ["ConnectorCapabilityWebhook","ConnectorCapabilityWalletVerify"]:
    descriptor_block=telegram_link_src[telegram_link_src.find("func (a *TelegramConnectorAdapter) Descriptor"):telegram_link_src.find("func (a *TelegramConnectorAdapter) Link")]
    if forbidden in descriptor_block: errors.append("MAIL-2.25 Telegram descriptor pulled later capability forward: "+forbidden)
if "ConnectorCapabilityWalletVerify" not in discord_src: errors.append("MAIL-2.18 Discord connector wallet capability missing")
for token in ["DiscordDeliveryAuthority","ConnectorCapabilityPush","DeliverDiscord","DiscordDeliveryKind"]:
    if token not in discord_src: errors.append("MAIL-2.17 Discord adapter delivery invariant missing: "+token)
for token in ['"/v1/connectors/discord/sync"',"*DiscordSyncService"]:
    if token not in http: errors.append("MAIL-2.16 HTTP Discord sync surface missing: "+token)
if "SyncDiscord" not in client: errors.append("MAIL-2.16 client Discord sync surface missing")
for token in ['"/v1/connectors/discord/deliver"',"*DiscordDeliveryService"]:
    if token not in http: errors.append("MAIL-2.17 HTTP Discord delivery surface missing: "+token)
if "DeliverDiscord" not in client: errors.append("MAIL-2.17 client Discord delivery surface missing")
for token in ["PrepareDiscordWalletVerification","VerifyDiscordWallet"]:
    if token not in client: errors.append("MAIL-2.18 client Discord wallet surface missing: "+token)
for token in ['"/v1/connectors/discord/wallet/challenge"','"/v1/connectors/discord/wallet/verify"',"*DiscordWalletVerificationService"]:
    if token not in http: errors.append("MAIL-2.18 HTTP Discord wallet surface missing: "+token)
if '"/v1/connectors/signal/boundary"' not in http: errors.append("MAIL-2.19 HTTP Signal boundary surface missing")
if "SignalIntegrationBoundary" not in client: errors.append("MAIL-2.19 client Signal boundary surface missing")
if '"/v1/connectors/signal/share"' not in http or "*SignalShareService" not in http: errors.append("MAIL-2.21 HTTP Signal share surface missing")
if "ShareToSignal" not in client: errors.append("MAIL-2.21 client Signal share surface missing")
if '"/v1/connectors/signal/deep-sync/status"' not in http: errors.append("MAIL-2.22 HTTP Signal deep-sync status surface missing")
if "SignalDeepSyncStatus" not in client: errors.append("MAIL-2.22 client Signal deep-sync status surface missing")
for token in ['"/v1/connectors/telegram/sync"',"*TelegramSyncService"]:
    if token not in http: errors.append("MAIL-2.24 HTTP Telegram sync surface missing: "+token)
if "SyncTelegram" not in client: errors.append("MAIL-2.24 client Telegram sync surface missing")
for token in ['"/v1/connectors/telegram/deliver"',"*TelegramDeliveryService"]:
    if token not in http: errors.append("MAIL-2.25 HTTP Telegram delivery surface missing: "+token)
if "DeliverTelegram" not in client: errors.append("MAIL-2.25 client Telegram delivery surface missing")
if '"/v1/integrations/inbox"' not in http: errors.append("MAIL-2.26 HTTP unified integrations inbox surface missing")
if "IntegrationsInbox" not in client: errors.append("MAIL-2.26 client unified integrations inbox surface missing")
if "IntegrationsInboxFiltered" not in client or 'q.Set("source", source)' not in client: errors.append("MAIL-2.28 client integration filter surface missing")
if '"/v1/integrations/identity"' not in http: errors.append("MAIL-2.27 HTTP cross-platform identity surface missing")
if "CrossPlatformIdentity" not in client: errors.append("MAIL-2.27 client cross-platform identity surface missing")
for token in ["LinkConnector","UnlinkConnector"]:
    if token not in client: errors.append("MAIL-2.23 client Telegram link surface missing: "+token)
for forbidden in ["ConnectorCapabilityPull, ConnectorCapabilityPush","ConnectorCapabilityWebhook","ConnectorCapabilityWalletVerify"]:
    pass
web=(ROOT/"mail/web/index.html").read_text() if (ROOT/"mail/web/index.html").is_file() else ""
for token in ["/v1/drafts","autosaveDraft","recoverDraft","discardDraft","expected_version"]:
    if token not in web: errors.append("MAIL-2.9 thin UI draft behavior missing: "+token)
for token in ["/v1/onboarding/","data-onboard","__420_ONBOARDING__","mailSession","non_custodial","session_token"]:
    if token not in web: errors.append("MAIL-2.11 thin UI onboarding behavior missing: "+token)
for token in ["/v1/security","data-security-action","__420_SECURITY__","loadSecurity","revokeSecurity","authorization_epoch"]:
    if token not in web: errors.append("MAIL-2.12 thin UI security behavior missing: "+token)
for token in ["/v1/wallet/actions","/v1/wallet/verifications","data-wallet-action","__420_WALLET_ACTIONS__","requires_wallet_approval","non_custodial"]:
    if token not in web: errors.append("MAIL-2.13 thin UI wallet behavior missing: "+token)
for token in ["/v1/connectors/providers","/v1/connectors/link","__420_CONNECTORS__","authorization_ref","loadConnectors","linkConnector"]:
    if token not in web: errors.append("MAIL-2.14 thin UI connector behavior missing: "+token)
for token in ["LINK","linkConnector","authorization_ref"]:
    if token not in web: errors.append("MAIL-2.23 provider-neutral Telegram link UI behavior missing: "+token)
for token in ["/v1/connectors/telegram/sync","syncTelegram","Sync Telegram","connectionId"]:
    if token not in web: errors.append("MAIL-2.24 thin UI Telegram sync behavior missing: "+token)
for token in ["/v1/connectors/telegram/deliver","deliverTelegram","Send to Telegram","chat_id"]:
    if token not in web: errors.append("MAIL-2.25 thin UI Telegram delivery behavior missing: "+token)
for token in ["/v1/integrations/inbox","loadIntegrationsInbox","Refresh integrations inbox","integrations-inbox"]:
    if token not in web: errors.append("MAIL-2.26 thin UI unified integrations inbox behavior missing: "+token)
for token in ["integrations-inbox-source","All integrations","Discord","Telegram","query.set('source',source)"]:
    if token not in web: errors.append("MAIL-2.28 thin UI integration filter behavior missing: "+token)
for token in ["/v1/integrations/identity","loadVerifiedIdentity","Refresh verified identity","verified-identity"]:
    if token not in web: errors.append("MAIL-2.27 thin UI verified identity behavior missing: "+token)
for token in ["/v1/connectors/discord/sync","syncDiscord","Sync Discord","connectionId"]:
    if token not in web: errors.append("MAIL-2.16 thin UI Discord sync behavior missing: "+token)
for token in ["/v1/connectors/discord/deliver","deliverDiscord","Send to Discord","delivery","idempotency_key"]:
    if token not in web: errors.append("MAIL-2.17 thin UI Discord delivery behavior missing: "+token)
for token in ["/v1/connectors/discord/wallet/challenge","/v1/connectors/discord/wallet/verify","verifyDiscordWallet","Verify Discord wallet","discordVerification","WALLET_VERIFY"]:
    if token not in web: errors.append("MAIL-2.18 thin UI Discord wallet behavior missing: "+token)
for token in ["/v1/connectors/signal/boundary","loadSignalBoundary","Signal boundary","SHARE_FORWARD_ENABLED","notifications + explicit share/forward enabled","/v1/connectors/signal/share","shareSignal","Share to Signal","Forward to Signal"]:
    if token not in web: errors.append("MAIL-2.21 thin UI Signal share behavior missing: "+token)
for token in ["/v1/connectors/signal/deep-sync/status","CONDITION_UNSATISFIED","supported_surface_found","deep sync"]:
    if token not in web: errors.append("MAIL-2.22 thin UI Signal deep-sync gate behavior missing: "+token)


if "body.textContent=d.body" not in web: errors.append("MAIL-2.7 thin UI no longer renders private body as inert text")
for token in ['id="desktop-mail-ui"','data-folder="INBOX"','data-folder="SENT"','data-view="drafts"','data-view="outbox"','data-folder="ARCHIVE"','data-folder="JUNK"','data-folder="TRASH"','data-search-view="unread"','data-search-view="starred"','data-view="conversations"','data-view="integrations"',"loadMailbox","searchMailbox","loadLabelsAndFolders","loadOutbox","loadConversations","updateCurrentMailbox","restoreCurrent","deleteCurrent","grid-template-columns:240px minmax(320px,420px) minmax(420px,1fr)"]:
    if token not in web: errors.append("MAIL-2.30 full desktop UI invariant missing: "+token)
for forbidden in ["body.innerHTML=d.body","reader.innerHTML=d.body","document.write(d.body)"]:
    if forbidden in web: errors.append("MAIL-2.30 private message body reaches active HTML sink: "+forbidden)
for token in ['id="settings-overlay"','id="settings-open"',"loadSettingsCenter","/v1/trust/settings","/v1/trust/entries","/v1/rules","saveTrustSettings","putTrustEntry","createRuleFromSettings","toggleRule","deleteRule","deleteSettingLabel","deleteSettingFolder",'id="settings-security-open"','id="settings-integrations-open"','id="settings-wallet-open"']:
    if token not in web: errors.append("MAIL-2.31 settings center invariant missing: "+token)
for forbidden in ['name="private_key"','name="seed_phrase"','name="access_token"','name="refresh_token"','name="client_secret"']:
    if forbidden in web: errors.append("MAIL-2.31 forbidden secret field exposed: "+forbidden)

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
print("MAIL-2.14 external integrations framework: qualified by app-scoped checks")
print("MAIL-2.15 Discord account linking: qualified by app-scoped checks")
print("MAIL-2.16 Discord to 420Mail sync: qualified by app-scoped checks")
print("MAIL-2.17 420Mail to Discord delivery: qualified by app-scoped checks")
print("MAIL-2.18 Discord wallet verification: qualified by app-scoped checks")
print("MAIL-2.19 Signal integration boundary: qualified by app-scoped checks")
print("MAIL-2.20 420Mail to Signal notifications: qualified by app-scoped checks")
print("MAIL-2.21 Signal share and forward: qualified by app-scoped checks")
print("MAIL-2.22 Signal deep sync: condition unsatisfied and gate qualified by app-scoped checks")
print("MAIL-2.23 Telegram account linking: qualified by app-scoped checks")
print("MAIL-2.24 Telegram to 420Mail sync: qualified by app-scoped checks")
print("MAIL-2.25 420Mail to Telegram delivery: qualified by app-scoped checks")
print("MAIL-2.26 unified integrations inbox: qualified by app-scoped checks")
print("MAIL-2.27 cross-platform verified identity: qualified by app-scoped checks")
print("MAIL-2.28 integration-specific filters: qualified by app-scoped checks")
print("MAIL-2.29 unified notification routing: qualified by app-scoped checks")
print("MAIL-2.30 full desktop mail UI: qualified by app-scoped checks")
print("MAIL-2.31 mail settings center: qualified by app-scoped checks")
print("MAIL-2.32 connector isolation: qualified by app-scoped checks")
print("MAIL-2.33 encryption and leakage controls: qualified by app-scoped checks")
print("MAIL-2.34 phishing and impersonation protection: qualified by app-scoped checks")
print("MAIL-2.35 abuse controls: qualified by app-scoped checks")
print("MAIL-2.36 repository qualification: qualified by exact-head app repository checks")

