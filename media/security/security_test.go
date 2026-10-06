package security

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"testing"
	"time"

	mediafixtures "github.com/420integrated/420-integrated/media/fixtures"
)

type resolverFake struct{ addrs []net.IPAddr }

func (r resolverFake) LookupIPAddr(context.Context, string) ([]net.IPAddr, error) {
	return r.addrs, nil
}

type scannerFake struct {
	result ScanResult
	err    error
}

func (s scannerFake) Scan(context.Context, Inspection) (ScanResult, error) {
	return s.result, s.err
}

type authFake struct{ allowed bool }

func (a authFake) CanModerate(context.Context, string) (bool, error) { return a.allowed, nil }

type sessionFake struct {
	claims SessionClaims
	err    error
}

func (s sessionFake) Verify(context.Context, string) (SessionClaims, error) { return s.claims, s.err }

func TestOutboundEndpointRejectsLocalPrivateAndResolvedSSRF(t *testing.T) {
	for _, raw := range []string{
		"http://localhost/whip",
		"https://127.0.0.1/whip",
		"https://10.0.0.2/whip",
		"https://[::1]/whip",
		"https://edge.local/whip",
	} {
		if err := ValidateOutboundEndpoint(raw, "https", "http"); !errors.Is(err, ErrUnsafeEndpoint) {
			t.Fatalf("%s err=%v", raw, err)
		}
	}
	if err := ValidateOutboundEndpoint("https://edge.example/whip", "https"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateResolvedEndpoint(context.Background(), "https://edge.example/whip", resolverFake{
		addrs: []net.IPAddr{{IP: net.ParseIP("192.168.1.20")}},
	}, "https"); !errors.Is(err, ErrUnsafeEndpoint) {
		t.Fatalf("resolved private err=%v", err)
	}
	if err := ValidateResolvedEndpoint(context.Background(), "https://edge.example/whip", resolverFake{
		addrs: []net.IPAddr{{IP: net.ParseIP("203.0.113.10")}},
	}, "https"); err != nil {
		t.Fatal(err)
	}
}

func TestRateLimiterFailsClosedAfterBound(t *testing.T) {
	limiter, err := NewRateLimiter(2, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 6, 20, 0, 0, 0, time.UTC)
	limiter.now = func() time.Time { return now }
	for i := 0; i < 2; i++ {
		if ok, _, _ := limiter.Allow("creator:upload"); !ok {
			t.Fatalf("attempt %d denied", i)
		}
	}
	if ok, remaining, _ := limiter.Allow("creator:upload"); ok || remaining != 0 {
		t.Fatalf("expected limit, ok=%v remaining=%d", ok, remaining)
	}
	now = now.Add(time.Minute)
	if ok, _, _ := limiter.Allow("creator:upload"); !ok {
		t.Fatal("window did not reset")
	}
}

func TestQuarantineGateRequiresScannerAndCleanVerdict(t *testing.T) {
	item := Inspection{
		AssetID: "asset-1", MimeType: "video/mp4", SizeBytes: 42,
		SHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", SourceRef: "upload-1",
	}
	gate := QuarantineGate{Policy: DefaultContentPolicy()}
	if _, err := gate.Inspect(context.Background(), item); !errors.Is(err, ErrScannerUnavailable) {
		t.Fatalf("missing scanner err=%v", err)
	}
	gate.Scanner = scannerFake{result: ScanResult{Verdict: ScanQuarantine, ScannerID: "scanner-1"}}
	if _, err := gate.Inspect(context.Background(), item); !errors.Is(err, ErrContentQuarantined) {
		t.Fatalf("quarantine err=%v", err)
	}
	gate.Scanner = scannerFake{result: ScanResult{Verdict: ScanClean, ScannerID: "scanner-1"}}
	if _, err := gate.Inspect(context.Background(), item); err != nil {
		t.Fatal(err)
	}
}

func TestWebhookVerifierRejectsTamperExpiryReplayAndSupportsKeyVersion(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	verifier, err := NewWebhookVerifier(map[string][]byte{"k1": key}, 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 6, 20, 0, 0, 0, time.UTC)
	verifier.Now = func() time.Time { return now }
	payload := []byte(`{"asset_id":"asset-1","status":"READY"}`)
	eventID := "event-1"
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(eventID + "\n" + now.Format(time.RFC3339Nano) + "\n"))
	_, _ = mac.Write(payload)
	sig := hex.EncodeToString(mac.Sum(nil))
	if err := verifier.Verify(eventID, "k1", now, payload, sig); err != nil {
		t.Fatal(err)
	}
	if err := verifier.Verify(eventID, "k1", now, payload, sig); !errors.Is(err, ErrWebhookReplay) {
		t.Fatalf("replay err=%v", err)
	}
	if err := verifier.Verify("event-2", "k1", now.Add(-10*time.Minute), payload, sig); !errors.Is(err, ErrWebhookExpired) {
		t.Fatalf("expiry err=%v", err)
	}
	if err := verifier.Verify("event-3", "missing", now, payload, sig); !errors.Is(err, ErrWebhookKey) {
		t.Fatalf("key err=%v", err)
	}
}

func TestModerationIsScopedAuditableAndAppealable(t *testing.T) {
	limiter, _ := NewRateLimiter(2, time.Minute)
	service, err := NewModerationService(authFake{allowed: true}, limiter)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 6, 20, 0, 0, 0, time.UTC)
	service.Now = func() time.Time { return now }
	report, err := service.Report(context.Background(), Report{
		ID: "report-1", ReporterRef: "USER", TargetKind: "MediaAsset", TargetID: "asset-1",
		Reason: "rights abuse", EvidenceRef: "sha256:evidence",
	})
	if err != nil {
		t.Fatal(err)
	}
	if report.CreatedAt != now {
		t.Fatalf("created=%v", report.CreatedAt)
	}
	decision, err := service.Decide(context.Background(), Decision{
		ID: "decision-1", ReportID: report.ID, ModeratorRef: "MODERATOR", Action: ActionHide, Reason: "pending rights review",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Appeal(context.Background(), Appeal{
		ID: "appeal-1", DecisionID: decision.ID, AppellantRef: "CREATOR", Reason: "licensed source",
	}); err != nil {
		t.Fatal(err)
	}
	reports, decisions, appeals := service.AuditTrail()
	if len(reports) != 1 || len(decisions) != 1 || len(appeals) != 1 {
		t.Fatalf("trail reports=%d decisions=%d appeals=%d", len(reports), len(decisions), len(appeals))
	}
}

func TestModerationRejectsUnauthorizedAndNonModerationActions(t *testing.T) {
	limiter, _ := NewRateLimiter(5, time.Minute)
	service, _ := NewModerationService(authFake{allowed: false}, limiter)
	_, _ = service.Report(context.Background(), Report{
		ID: "report-1", ReporterRef: "USER", TargetKind: "MediaAsset", TargetID: "asset-1", Reason: "abuse",
	})
	if _, err := service.Decide(context.Background(), Decision{
		ID: "decision-1", ReportID: "report-1", ModeratorRef: "USER", Action: ActionHide, Reason: "hide",
	}); !errors.Is(err, ErrModerationDenied) {
		t.Fatalf("unauthorized err=%v", err)
	}
	service.Auth = authFake{allowed: true}
	if _, err := service.Decide(context.Background(), Decision{
		ID: "decision-2", ReportID: "report-1", ModeratorRef: "MODERATOR", Action: ActionBlock, Reason: "user-scoped action",
	}); !errors.Is(err, ErrInvalidModeration) {
		t.Fatalf("action err=%v", err)
	}
}

func TestSessionBoundaryValidatesExpiryChainNetworkAndCapability(t *testing.T) {
	now := time.Date(2026, 10, 6, 20, 0, 0, 0, time.UTC)
	claims := SessionClaims{
		SessionID: "session-1", Actor: "CREATOR", Wallet: "0x1111111111111111111111111111111111111111",
		ChainID: 420, Network: "testnet", ExpiresAt: now.Add(time.Hour),
		Capabilities: map[string]bool{"media.upload": true},
	}
	if _, err := RequireSession(context.Background(), sessionFake{claims: claims}, "token", 420, "testnet", "media.upload", now); err != nil {
		t.Fatal(err)
	}
	if _, err := RequireSession(context.Background(), sessionFake{claims: claims}, "token", 421, "testnet", "media.upload", now); !errors.Is(err, ErrSessionScope) {
		t.Fatalf("chain err=%v", err)
	}
	if _, err := RequireSession(context.Background(), sessionFake{claims: claims}, "token", 420, "testnet", "media.moderate", now); !errors.Is(err, ErrSessionScope) {
		t.Fatalf("cap err=%v", err)
	}
	claims.ExpiresAt = now
	if _, err := RequireSession(context.Background(), sessionFake{claims: claims}, "token", 420, "testnet", "", now); !errors.Is(err, ErrSessionExpired) {
		t.Fatalf("expiry err=%v", err)
	}
}

func TestGENSVCMediaFixturePersonasAndJourneys(t *testing.T) {
	fixture := mediafixtures.CanonicalMediaJourney()
	if fixture.Creator.Name != "CREATOR" || fixture.Follower.Name != "USER" || fixture.Moderator.Name != "MODERATOR" {
		t.Fatalf("personas=%+v", fixture)
	}
	want := []string{"SVC-JOURNEY-001", "SVC-JOURNEY-008", "SVC-JOURNEY-009", "SVC-JOURNEY-010"}
	if len(fixture.Journeys) != len(want) {
		t.Fatalf("journeys=%v", fixture.Journeys)
	}
	for i := range want {
		if fixture.Journeys[i] != want[i] {
			t.Fatalf("journey[%d]=%q", i, fixture.Journeys[i])
		}
	}
}
