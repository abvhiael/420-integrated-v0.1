package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

type sessionMap map[string]mediasecurity.SessionClaims

func (m sessionMap) Verify(_ context.Context, token string) (mediasecurity.SessionClaims, error) {
	claims, ok := m[token]
	if !ok {
		return mediasecurity.SessionClaims{}, mediasecurity.ErrSessionRequired
	}
	return claims, nil
}

type moderatorAuth struct{}

func (moderatorAuth) CanModerate(_ context.Context, actor string) (bool, error) {
	return actor == "MODERATOR", nil
}

func secureServerFixture(t *testing.T) *httptest.Server {
	t.Helper()
	now := time.Date(2026, 10, 6, 20, 30, 0, 0, time.UTC)
	limiter, err := mediasecurity.NewRateLimiter(10, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	moderation, err := mediasecurity.NewModerationService(moderatorAuth{}, limiter)
	if err != nil {
		t.Fatal(err)
	}
	moderation.Now = func() time.Time { return now }
	sessions := sessionMap{
		"creator": {
			SessionID: "creator-session", Actor: "CREATOR",
			Wallet: "0x1111111111111111111111111111111111111111",
			ChainID: 420, Network: "testnet", ExpiresAt: now.Add(time.Hour),
			Capabilities: map[string]bool{
				"media.upload": true, "media.livestream": true, "media.notifications": true,
				"media.sign": true, "media.report": true, "media.appeal": true,
			},
		},
		"moderator": {
			SessionID: "moderator-session", Actor: "MODERATOR",
			Wallet: "0x2222222222222222222222222222222222222222",
			ChainID: 420, Network: "testnet", ExpiresAt: now.Add(time.Hour),
			Capabilities: map[string]bool{"media.moderate": true},
		},
	}
	server, err := NewSecureServer(&testBackend{}, SecurityConfig{
		Sessions: sessions, Moderation: moderation, ExpectedChainID: 420, ExpectedNetwork: "testnet",
		Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatal(err)
	}
	server.Now = func() time.Time { return now }
	return httptest.NewServer(server.Handler())
}

func TestSecureServerRejectsMissingSessionAndActorSubstitution(t *testing.T) {
	ts := secureServerFixture(t)
	defer ts.Close()
	body := `{"id":"asset-1","owner_ref":"CREATOR","mime_type":"video/mp4","visibility":"PRIVATE","provenance_ref":"prov","object_id":"obj","manifest_id":"manifest","shard_index":0,"shard_root":"aaaaaaaa","size_bytes":42,"commitment_id":"commit","preconditions":{"agreement_id":"agreement","capacity_reservation_id":"capacity","commitment_id":"commit"}}`
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/uploads/prepare", strings.NewReader(body))
	req.Header.Set("Idempotency-Key", "secure-1")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("missing session status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	bad := strings.Replace(body, `"owner_ref":"CREATOR"`, `"owner_ref":"OTHER"`, 1)
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/v1/uploads/prepare", strings.NewReader(bad))
	req.Header.Set("Idempotency-Key", "secure-2")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("substitution status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()
}

func TestSecureServerAllowsScopedUploadAndModerationAppealTrail(t *testing.T) {
	ts := secureServerFixture(t)
	defer ts.Close()
	upload := `{"id":"asset-1","owner_ref":"CREATOR","mime_type":"video/mp4","visibility":"PRIVATE","provenance_ref":"prov","object_id":"obj","manifest_id":"manifest","shard_index":0,"shard_root":"aaaaaaaa","size_bytes":42,"commitment_id":"commit","preconditions":{"agreement_id":"agreement","capacity_reservation_id":"capacity","commitment_id":"commit"}}`
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/uploads/prepare", strings.NewReader(upload))
	req.Header.Set("Idempotency-Key", "secure-upload")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("upload status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	reportBody := `{"id":"report-1","reporter_ref":"CREATOR","target_kind":"MediaAsset","target_id":"asset-1","reason":"rights abuse","evidence_ref":"sha256:evidence"}`
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/v1/moderation/reports", strings.NewReader(reportBody))
	req.Header.Set("Idempotency-Key", "report-key")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("report status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	decisionBody := `{"id":"decision-1","moderator_ref":"MODERATOR","action":"HIDE","reason":"pending rights review"}`
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/v1/moderation/reports/report-1/decisions", strings.NewReader(decisionBody))
	req.Header.Set("Idempotency-Key", "decision-key")
	req.Header.Set("Authorization", "Bearer moderator")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("decision status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	appealBody := `{"id":"appeal-1","appellant_ref":"CREATOR","reason":"licensed source"}`
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/v1/moderation/decisions/decision-1/appeals", strings.NewReader(appealBody))
	req.Header.Set("Idempotency-Key", "appeal-key")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("appeal status=%d", resp.StatusCode)
	}
	var envelope Envelope[mediasecurity.Appeal]
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.DecisionID != "decision-1" || envelope.Data.AppellantRef != "CREATOR" {
		t.Fatalf("appeal=%+v", envelope.Data)
	}
}

func TestSecureServerRejectsUnsafeLivestreamAndInvalidUploadMetadata(t *testing.T) {
	ts := secureServerFixture(t)
	defer ts.Close()
	live := `{"id":"live-1","controller":"0x1111111111111111111111111111111111111111","protocol":"WHIP","direction":"INGEST","endpoint":"https://127.0.0.1/whip","stream_ref":"stream-1"}`
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/livestreams", strings.NewReader(live))
	req.Header.Set("Idempotency-Key", "live-unsafe")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unsafe live status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	upload := `{"id":"asset-x","owner_ref":"CREATOR","mime_type":"text/html","visibility":"PRIVATE","provenance_ref":"prov","object_id":"obj","manifest_id":"manifest","shard_index":0,"shard_root":"aaaaaaaa","size_bytes":42,"commitment_id":"commit","preconditions":{"agreement_id":"agreement","capacity_reservation_id":"capacity","commitment_id":"commit"}}`
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/v1/uploads/prepare", strings.NewReader(upload))
	req.Header.Set("Idempotency-Key", "upload-invalid")
	req.Header.Set("Authorization", "Bearer creator")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid upload status=%d", resp.StatusCode)
	}
	_ = resp.Body.Close()
}
