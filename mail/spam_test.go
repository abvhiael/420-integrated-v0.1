package mail

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPhishingDeliveryIsQuarantinedAndNotificationSuppressed(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()

	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "phish-1",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "Urgent action required",
		Body:           "Verify your wallet now at http://127.0.0.1/login",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk || !state.Muted || state.JunkedAt == nil {
		t.Fatalf("phishing message not quarantined: %+v", state)
	}
	if notify.Count() != 0 {
		t.Fatalf("quarantined phishing emitted %d notifications", notify.Count())
	}
	records, err := s.ListQuarantine(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].MessageID != msg.ID || records[0].PhishingScore < PhishingQuarantineScore {
		t.Fatalf("unexpected quarantine record: %+v", records)
	}
	if len(records[0].Reasons) == 0 {
		t.Fatal("quarantine record lacks reasons")
	}
}

func TestTrustedSenderBypassesSpamSignalsButNotPhishing(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()
	if _, err := s.PutTrustEntry(ctx, "bob.420", TrustIdentity, "alice.420", TrustAllow); err != nil {
		t.Fatal(err)
	}

	for i, key := range []string{"dup-1", "dup-2", "dup-3", "dup-4"} {
		msg, err := s.Send(ctx, "alice.420", SendRequest{
			IdempotencyKey: key,
			Sender:         "alice.420",
			Recipient:      "bob.420",
			Subject:        "same safe newsletter",
			Body:           "same safe content",
			Source:         ServiceID,
		})
		if err != nil {
			t.Fatal(err)
		}
		state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
		if err != nil {
			t.Fatal(err)
		}
		if state.Folder != FolderInbox {
			t.Fatalf("trusted duplicate %d unexpectedly quarantined: %+v", i+1, state)
		}
	}
	if notify.Count() != 4 {
		t.Fatalf("trusted safe mail notification count=%d", notify.Count())
	}

	phish, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "trusted-phish",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "Account will be suspended",
		Body:           "Confirm your credentials at http://10.0.0.1/verify",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", phish.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk {
		t.Fatalf("trusted sender bypassed phishing quarantine: %+v", state)
	}
	if notify.Count() != 4 {
		t.Fatalf("trusted phishing emitted notification, count=%d", notify.Count())
	}
}

func TestDuplicateContentQuarantinesFourthDelivery(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()
	var fourth Message
	for i, key := range []string{"bulk-1", "bulk-2", "bulk-3", "bulk-4"} {
		msg, err := s.Send(ctx, "alice.420", SendRequest{
			IdempotencyKey: key,
			Sender:         "alice.420",
			Recipient:      "bob.420",
			Subject:        "bulk offer",
			Body:           "identical bulk message",
			Source:         ServiceID,
		})
		if err != nil {
			t.Fatal(err)
		}
		state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
		if err != nil {
			t.Fatal(err)
		}
		if i < 3 && state.Folder != FolderInbox {
			t.Fatalf("delivery %d quarantined too early: %+v", i+1, state)
		}
		if i == 3 {
			fourth = msg
			if state.Folder != FolderJunk || !state.Muted {
				t.Fatalf("fourth duplicate not quarantined: %+v", state)
			}
		}
	}
	if fourth.ID == "" {
		t.Fatal("fourth duplicate missing")
	}
	if notify.Count() != 3 {
		t.Fatalf("duplicate quarantine notification count=%d want 3", notify.Count())
	}
}

func TestAbuseReportsDriveOwnerScopedReputationAndRelease(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	var messages []Message
	for i, key := range []string{"rep-1", "rep-2", "rep-3"} {
		msg, err := s.Send(ctx, "alice.420", SendRequest{
			IdempotencyKey: key,
			Sender:         "alice.420",
			Recipient:      "bob.420",
			Subject:        "message " + key,
			Body:           "ordinary body " + key,
			Source:         ServiceID,
		})
		if err != nil {
			t.Fatal(err)
		}
		messages = append(messages, msg)
		report, err := s.ReportAbuse(ctx, "bob.420", msg.ID, AbuseSpam)
		if err != nil {
			t.Fatal(err)
		}
		if report.Kind != AbuseSpam || report.Owner != "bob.420" {
			t.Fatalf("unexpected abuse report %d: %+v", i, report)
		}
	}
	firstRepeat, err := s.ReportAbuse(ctx, "bob.420", messages[0].ID, AbuseSpam)
	if err != nil {
		t.Fatal(err)
	}
	if firstRepeat.MessageID != messages[0].ID {
		t.Fatalf("idempotent abuse report mismatch: %+v", firstRepeat)
	}
	if _, err := s.ReportAbuse(ctx, "bob.420", messages[0].ID, AbusePhishing); !errors.Is(err, ErrAbuseReportConflict) {
		t.Fatalf("changed abuse classification error=%v", err)
	}
	if _, err := s.ReportAbuse(ctx, "alice.420", messages[0].ID, AbuseSpam); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("sender reported recipient-owned delivery: %v", err)
	}

	rep, err := s.GetSenderReputation(ctx, "bob.420", "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if rep.SpamReports != 3 || rep.RiskScore != SpamReputationThreshold {
		t.Fatalf("unexpected reputation after reports: %+v", rep)
	}
	other, err := s.GetSenderReputation(ctx, "alice.420", "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if other.RiskScore != 0 {
		t.Fatalf("reputation leaked across owners: %+v", other)
	}

	next, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "rep-next",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "new ordinary message",
		Body:           "new ordinary body",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", next.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk {
		t.Fatalf("reputation did not quarantine future sender mail: %+v", state)
	}

	inbox := FolderInbox
	if _, err := s.UpdateMailbox(ctx, "bob.420", next.ID, MailboxUpdate{Folder: &inbox}); !errors.Is(err, ErrQuarantineReview) {
		t.Fatalf("general mailbox move bypassed quarantine review: %v", err)
	}
	released, err := s.ReleaseQuarantine(ctx, "bob.420", next.ID)
	if err != nil {
		t.Fatal(err)
	}
	if released.Folder != FolderInbox || released.Muted {
		t.Fatalf("release did not restore recipient copy: %+v", released)
	}
	rep, err = s.GetSenderReputation(ctx, "bob.420", "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if rep.FalsePositives != 1 || rep.RiskScore != SpamReputationThreshold-1 {
		t.Fatalf("false-positive release did not reduce risk: %+v", rep)
	}
	active, err := s.ListQuarantine(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, record := range active {
		if record.MessageID == next.ID {
			t.Fatal("released quarantine still listed active")
		}
	}
}

func TestAbuseReportPreservesTrashState(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "trash-report",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "ordinary",
		Body:           "ordinary",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	trash := FolderTrash
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ReportAbuse(ctx, "bob.420", msg.ID, AbuseSpam); err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderTrash {
		t.Fatalf("abuse report resurrected trashed mail: %+v", state)
	}
}

func TestPhishingSignalBoundaries(t *testing.T) {
	score, reasons := phishingSignals("hello", "Visit https://example.com/news", nil)
	if score != 0 || len(reasons) != 0 {
		t.Fatalf("ordinary HTTPS link flagged: score=%d reasons=%v", score, reasons)
	}
	score, reasons = phishingSignals("hello", "Visit https://trusted.example@evil.example/login", nil)
	if score < PhishingQuarantineScore || len(reasons) == 0 {
		t.Fatalf("URL userinfo phishing signal missed: score=%d reasons=%v", score, reasons)
	}
	score, reasons = phishingSignals("hello", "Recovery phrase info without any link", nil)
	if score != 0 || len(reasons) != 0 {
		t.Fatalf("credential phrase without link over-triggered: score=%d reasons=%v", score, reasons)
	}
}

func TestSpamProtectionDurableRestartAndV4Migration(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail-state.json")
	legacy := diskStoreData{
		SchemaVersion:     4,
		Messages:          map[string]Message{},
		ByIdem:            map[string]string{},
		Mailbox:           map[string]MailboxState{},
		MailboxIndex:      map[string][]string{},
		Labels:            map[string]LabelDefinition{},
		CustomFolders:     map[string]CustomFolder{},
		LabelIndex:        map[string][]string{},
		CustomFolderIndex: map[string][]string{},
		Rules:             map[string]MailRule{},
		TrustEntries:      map[string]TrustEntry{},
		TrustSettings:     map[string]TrustSettings{},
		Fingerprints:      map[string]string{},
		IdempotencyKeys:   map[string]string{},
	}
	raw, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.View(ctx, func(data *storeData) error {
		if data.SchemaVersion != DurableStoreSchemaVersion || data.Reputation == nil || data.AbuseReports == nil || data.Quarantine == nil || data.ContentFingerprints == nil {
			t.Fatalf("v4->v5 migration incomplete: %+v", data)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	blobs := &testBlobs{}
	first := durableTestService(t, path, blobs)
	msg, err := first.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "durable-phish",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "Urgent action required",
		Body:           "Verify your wallet at http://192.0.2.1/login",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	restarted := durableTestService(t, path, blobs)
	records, err := restarted.ListQuarantine(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].MessageID != msg.ID {
		t.Fatalf("quarantine did not survive restart: %+v", records)
	}
	rep, err := restarted.GetSenderReputation(ctx, "bob.420", "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if rep.Deliveries != 1 || rep.Quarantines != 1 {
		t.Fatalf("reputation did not survive restart: %+v", rep)
	}
	raw, err = os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "Verify your wallet") {
		t.Fatal("spam-protection metadata persisted private message body plaintext")
	}
}

func TestProtectedEcosystemDomainLookalikesAreQuarantined(t *testing.T) {
	s, notify := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{
		IdempotencyKey: "lookalike-domain",
		Sender:         "alice.420", Recipient: "bob.420",
		Subject: "Security notice",
		Body:    "Review at https://420integrated-login.example/verify",
		Source:  ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk || !state.Muted {
		t.Fatalf("lookalike ecosystem domain not quarantined: %+v", state)
	}
	if notify.Count() != 0 {
		t.Fatalf("lookalike-domain phishing emitted notification: %d", notify.Count())
	}
	records, err := s.ListQuarantine(ctx, "bob.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || !containsString(records[0].Reasons, "LOOKALIKE_ECOSYSTEM_DOMAIN") {
		t.Fatalf("lookalike-domain reason missing: %+v", records)
	}
}

func TestOfficialEcosystemDomainDoesNotTriggerLookalikeSignal(t *testing.T) {
	score, reasons := phishingSignals("hello", "Visit https://420integrated.org/security", nil)
	if score != 0 || containsString(reasons, "LOOKALIKE_ECOSYSTEM_DOMAIN") {
		t.Fatalf("official ecosystem domain treated as lookalike: score=%d reasons=%v", score, reasons)
	}
	score, reasons = phishingSignals("hello", "Visit https://mail.420integrated.org/security", nil)
	if score != 0 || containsString(reasons, "LOOKALIKE_ECOSYSTEM_DOMAIN") {
		t.Fatalf("official ecosystem subdomain treated as lookalike: score=%d reasons=%v", score, reasons)
	}
}

func TestExternalProtectedIdentityImpersonationSignals(t *testing.T) {
	base := spamDecision{}
	got := applyExternalImpersonationSignals(base, DiscordProvider, "420Mail")
	if !got.Quarantine || got.PhishingScore < PhishingQuarantineScore || !containsString(got.Reasons, "EXTERNAL_PROTECTED_IDENTITY_CLAIM") {
		t.Fatalf("external protected identity claim not quarantined: %+v", got)
	}
	confusable := applyExternalImpersonationSignals(base, TelegramProvider, "420Mаil") // Cyrillic a.
	if !confusable.Quarantine || !containsString(confusable.Reasons, "CONFUSABLE_PROTECTED_IDENTITY_CLAIM") {
		t.Fatalf("confusable protected identity claim not detected: %+v", confusable)
	}
	safe := applyExternalImpersonationSignals(base, DiscordProvider, "ordinary_user")
	if safe.Quarantine || safe.PhishingScore != 0 || len(safe.Reasons) != 0 {
		t.Fatalf("ordinary external display over-triggered: %+v", safe)
	}
	native := applyExternalImpersonationSignals(base, ServiceID, "420Mail")
	if native.Quarantine || native.PhishingScore != 0 {
		t.Fatalf("native canonical sender path incorrectly treated as external impersonation: %+v", native)
	}
}
