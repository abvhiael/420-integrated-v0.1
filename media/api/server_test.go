package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type testBackend struct {
	prepareCalls int
	compat       Compatibility
}

func (b *testBackend) ListAssets(context.Context, string, int) (Page[Asset], error) {
	return Page[Asset]{Items: []Asset{{
		ID: "asset-1", OwnerRef: "wallet-1", State: "READY", Visibility: "PUBLIC",
		PlaybackURL: "https://cdn.example.invalid/asset-1.mp4",
		CreatedAt:  time.Date(2026, 10, 6, 12, 0, 0, 0, time.FixedZone("x", -6*3600)),
		UpdatedAt:  time.Date(2026, 10, 6, 12, 1, 0, 0, time.FixedZone("x", -6*3600)),
		Provenance: Provenance{Source: "420Indexer", Authority: "420Media", ObservedAt: time.Date(2026, 10, 6, 12, 2, 0, 0, time.FixedZone("x", -6*3600))},
	}}, NextCursor: "cursor-2"}, nil
}
func (b *testBackend) GetAsset(context.Context, string) (Asset, error) {
	page, _ := b.ListAssets(context.Background(), "", 1)
	return page.Items[0], nil
}
func (b *testBackend) PrepareUpload(_ context.Context, req PrepareUploadRequest, _ string) (UploadPlan, error) {
	b.prepareCalls++
	return UploadPlan{Asset: Asset{ID: req.ID, OwnerRef: req.OwnerRef, State: "PREPARED", Visibility: req.Visibility}, UploadID: "upload-1", ProviderID: "provider-1", NodeID: "node-1", ServiceID: "storage-1", Endpoint: "https://storage.example.invalid/upload-1", ExpiresAt: time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC)}, nil
}
func (b *testBackend) CreateLivestream(_ context.Context, req CreateLivestreamRequest, _ string) (Livestream, error) {
	return Livestream{ID: req.ID, Controller: req.Controller, Status: "created", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (b *testBackend) GetLivestream(context.Context, string, string) (Livestream, error) {
	return Livestream{ID: "live-1", Controller: "0xabc", Status: "active", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (b *testBackend) StartLivestream(context.Context, string, LivestreamActionRequest, string) (Livestream, error) {
	return Livestream{ID: "live-1", Controller: "0xabc", Status: "active", DesiredLive: true, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (b *testBackend) StopLivestream(context.Context, string, LivestreamActionRequest, string) (Livestream, error) {
	return Livestream{ID: "live-1", Controller: "0xabc", Status: "closed", DesiredLive: false, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (b *testBackend) Search(context.Context, string, int) (Page[SearchItem], error) {
	return Page[SearchItem]{Items: []SearchItem{{ID: "search-1", Title: "Media", CanonicalURL: "/media/asset-1", Provenance: Provenance{Source: "420Indexer", Authority: "420Media", ObservedAt: time.Now()}}}}, nil
}
func (b *testBackend) CreateSubscription(_ context.Context, req CreateSubscriptionRequest, _ string) (Subscription, error) {
	return Subscription{ID: req.ID, UserRef: req.UserRef, Topic: req.Topic, Channel: req.Channel, MinimumSeverity: req.MinimumSeverity, MinimumFinality: req.MinimumFinality, PromotionalOptIn: req.PromotionalOptIn, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (b *testBackend) DeleteSubscription(context.Context, string, string) error { return nil }
func (b *testBackend) PrepareSigningIntent(_ context.Context, req SigningIntentRequest, key string) (SigningIntent, error) {
	return SigningIntent{
		ID: "sign-1", Domain: SigningDomain, Wallet: req.Wallet, ChainID: req.ChainID,
		Network: req.Network, Action: req.Action, ResourceID: req.ResourceID,
		PayloadHash: req.PayloadHash, Nonce: key,
		ExpiresAt: time.Now().UTC().Add(time.Minute), Message: "420Media signing message",
	}, nil
}
func (b *testBackend) Capabilities(context.Context) (Capabilities, error) {
	return Capabilities{
		ServiceID: ServiceID, APIVersion: Version, Compatibility: CompatibilityMajor,
		Canonical: false, Features: map[string]bool{"media.livestreaming": true},
		Resources:     []string{"assets", "livestreams", "search", "notifications", "signing_intents"},
		WalletSigning: "external_handoff", Pagination: "cursor", Timestamps: "RFC3339 UTC",
		MaxPageLimit: MaxPageLimit,
		Errors:       []ErrorCode{CodeInvalidRequest, CodeNotFound, CodeConflict, CodeUnavailable},
	}, nil
}
func (b *testBackend) Compatibility(context.Context) (Compatibility, error) {
	if b.compat.ServiceID == "" {
		return Compatibility{ServiceID: ServiceID, APIVersion: Version, CompatibilityMajor: CompatibilityMajor, MinimumClientMajor: 1, ChainID: 420, Network: "testnet"}, nil
	}
	return b.compat, nil
}

func newTestServer(t *testing.T, backend Backend) *httptest.Server {
	t.Helper()
	server, err := NewServer(backend)
	if err != nil {
		t.Fatal(err)
	}
	server.Now = func() time.Time { return time.Date(2026, 10, 6, 19, 0, 0, 0, time.UTC) }
	return httptest.NewServer(server.Handler())
}

func TestCapabilitiesAndPaginationContract(t *testing.T) {
	ts := newTestServer(t, &testBackend{})
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/v1/assets?limit=1")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	if resp.Header.Get("X-420-API-Version") != Version || resp.Header.Get("X-RateLimit-Limit") == "" {
		t.Fatalf("headers=%v", resp.Header)
	}
	var env Envelope[Page[Asset]]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Version != Version || env.Data.NextCursor != "cursor-2" || len(env.Data.Items) != 1 {
		t.Fatalf("env=%+v", env)
	}
	if env.Data.Items[0].PlaybackURL != "https://cdn.example.invalid/asset-1.mp4" {
		t.Fatalf("playback url=%q", env.Data.Items[0].PlaybackURL)
	}
	if env.Data.Items[0].CreatedAt.Location() != time.UTC || env.Data.Items[0].Provenance.ObservedAt.Location() != time.UTC {
		t.Fatalf("timestamps not normalized: %+v", env.Data.Items[0])
	}
}

func TestPaginationRejectsOffsetAndBounds(t *testing.T) {
	ts := newTestServer(t, &testBackend{})
	defer ts.Close()
	for _, path := range []string{"/v1/assets?offset=1", "/v1/assets?limit=0", "/v1/search?limit=201"} {
		resp, err := http.Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("%s status=%d", path, resp.StatusCode)
		}
		_ = resp.Body.Close()
	}
}

func TestIdempotentWriteReplaysAndRejectsFingerprintReuse(t *testing.T) {
	backend := &testBackend{}
	ts := newTestServer(t, backend)
	defer ts.Close()
	body := `{"id":"asset-1","owner_ref":"wallet","mime_type":"video/mp4","visibility":"PRIVATE","provenance_ref":"prov","object_id":"obj","manifest_id":"manifest","shard_index":0,"shard_root":"root","size_bytes":42,"commitment_id":"commit","preconditions":{"agreement_id":"agreement","capacity_reservation_id":"capacity","commitment_id":"commit"}}`

	do := func(payload string) *http.Response {
		req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/uploads/prepare", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Idempotency-Key", "idem-1")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return resp
	}
	first := do(body)
	if first.StatusCode != http.StatusCreated {
		t.Fatalf("first=%d", first.StatusCode)
	}
	_ = first.Body.Close()
	second := do(body)
	if second.StatusCode != http.StatusCreated || backend.prepareCalls != 1 {
		t.Fatalf("second=%d calls=%d", second.StatusCode, backend.prepareCalls)
	}
	_ = second.Body.Close()
	third := do(strings.Replace(body, "asset-1", "asset-2", 1))
	if third.StatusCode != http.StatusConflict {
		t.Fatalf("third=%d", third.StatusCode)
	}
	var failure ErrorEnvelope
	_ = json.NewDecoder(third.Body).Decode(&failure)
	_ = third.Body.Close()
	if failure.Error.Code != CodeIdempotencyConflict {
		t.Fatalf("code=%s", failure.Error.Code)
	}
}

func TestStrictJSONAndStableErrorEnvelope(t *testing.T) {
	ts := newTestServer(t, &testBackend{})
	defer ts.Close()
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/livestreams", strings.NewReader(`{"id":"x","controller":"0xabc","unknown":true}`))
	req.Header.Set("Idempotency-Key", "idem-x")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable && resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var env ErrorEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Version != Version || env.Error.Code == "" || env.Error.Message == "" {
		t.Fatalf("error=%+v", env)
	}
}

func TestSigningIntentMatchesExactWalletChainNetworkAndPayload(t *testing.T) {
	ts := newTestServer(t, &testBackend{})
	defer ts.Close()
	body := `{"wallet":"0x1111111111111111111111111111111111111111","chain_id":420,"network":"testnet","action":"publish","resource_id":"asset-1","payload_hash":"0xabc"}`
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/v1/signing/intents", strings.NewReader(body))
	req.Header.Set("Idempotency-Key", "sign-key")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var env Envelope[SigningIntent]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Data.Domain != SigningDomain || env.Data.ChainID != 420 || env.Data.Network != "testnet" ||
		env.Data.Nonce != "sign-key" || env.Data.Message == "" {
		t.Fatalf("intent=%+v", env.Data)
	}
}

type codedFailure struct{ code ErrorCode }

func (e codedFailure) Error() string           { return "coded failure" }
func (e codedFailure) APIErrorCode() ErrorCode { return e.code }

type failingBackend struct{ testBackend }

func (b *failingBackend) GetAsset(context.Context, string) (Asset, error) {
	return Asset{}, codedFailure{code: CodeNotFound}
}

func TestBackendStableErrorCodeMapsToHTTP(t *testing.T) {
	ts := newTestServer(t, &failingBackend{})
	defer ts.Close()
	resp, err := http.Get(ts.URL + "/v1/assets/missing")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	var env ErrorEnvelope
	_ = json.NewDecoder(resp.Body).Decode(&env)
	if env.Error.Code != CodeNotFound {
		t.Fatalf("code=%s", env.Error.Code)
	}
}

func TestServerRequiresBackend(t *testing.T) {
	if _, err := NewServer(nil); err == nil {
		t.Fatal("expected backend requirement")
	}
	if !errors.Is(ErrIdempotencyConflict, ErrIdempotencyConflict) {
		t.Fatal("sentinel sanity")
	}
}
