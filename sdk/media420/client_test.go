package media420

import (
	"context"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	mediaapi "github.com/420integrated/420-integrated/media/api"
	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

type backendFake struct {
	compat mediaapi.Compatibility
}

func (b *backendFake) ListAssets(context.Context, string, int) (mediaapi.Page[mediaapi.Asset], error) {
	return mediaapi.Page[mediaapi.Asset]{Items: []mediaapi.Asset{{ID: "asset-1", State: "READY", Visibility: "PUBLIC"}}}, nil
}
func (b *backendFake) GetAsset(context.Context, string) (mediaapi.Asset, error) {
	return mediaapi.Asset{ID: "asset-1", State: "READY", Visibility: "PUBLIC"}, nil
}
func (b *backendFake) PrepareUpload(_ context.Context, req mediaapi.PrepareUploadRequest, _ string) (mediaapi.UploadPlan, error) {
	return mediaapi.UploadPlan{Asset: mediaapi.Asset{ID: req.ID}, UploadID: "upload-1", ProviderID: "provider-1", NodeID: "node-1", ServiceID: "storage-1"}, nil
}
func (b *backendFake) CreateLivestream(_ context.Context, req mediaapi.CreateLivestreamRequest, _ string) (mediaapi.Livestream, error) {
	return mediaapi.Livestream{ID: req.ID, Controller: req.Controller, Status: "created"}, nil
}
func (b *backendFake) GetLivestream(context.Context, string, string) (mediaapi.Livestream, error) {
	return mediaapi.Livestream{ID: "live-1", Controller: "0x1111111111111111111111111111111111111111", Status: "active"}, nil
}
func (b *backendFake) StartLivestream(context.Context, string, mediaapi.LivestreamActionRequest, string) (mediaapi.Livestream, error) {
	return mediaapi.Livestream{ID: "live-1", Status: "active", DesiredLive: true}, nil
}
func (b *backendFake) StopLivestream(context.Context, string, mediaapi.LivestreamActionRequest, string) (mediaapi.Livestream, error) {
	return mediaapi.Livestream{ID: "live-1", Status: "closed"}, nil
}
func (b *backendFake) Search(context.Context, string, int) (mediaapi.Page[mediaapi.SearchItem], error) {
	return mediaapi.Page[mediaapi.SearchItem]{Items: []mediaapi.SearchItem{{ID: "search-1", Title: "Media", CanonicalURL: "/media/asset-1"}}}, nil
}
func (b *backendFake) CreateSubscription(_ context.Context, req mediaapi.CreateSubscriptionRequest, _ string) (mediaapi.Subscription, error) {
	return mediaapi.Subscription{ID: req.ID, UserRef: req.UserRef, Topic: req.Topic, Channel: req.Channel}, nil
}
func (b *backendFake) DeleteSubscription(context.Context, string, string) error { return nil }
func (b *backendFake) PrepareSigningIntent(_ context.Context, req mediaapi.SigningIntentRequest, key string) (mediaapi.SigningIntent, error) {
	return mediaapi.SigningIntent{
		ID: "intent-1", Domain: mediaapi.SigningDomain, Wallet: req.Wallet,
		ChainID: req.ChainID, Network: req.Network, Action: req.Action,
		ResourceID: req.ResourceID, PayloadHash: req.PayloadHash, Nonce: key,
		ExpiresAt: time.Now().UTC().Add(time.Minute), Message: "sign-this-message",
	}, nil
}
func (b *backendFake) Capabilities(context.Context) (mediaapi.Capabilities, error) {
	return mediaapi.Capabilities{
		ServiceID: mediaapi.ServiceID, APIVersion: mediaapi.Version,
		Compatibility: mediaapi.CompatibilityMajor, Canonical: false,
		WalletSigning: "external_handoff", Pagination: "cursor", Timestamps: "RFC3339 UTC",
		MaxPageLimit: mediaapi.MaxPageLimit,
	}, nil
}
func (b *backendFake) Compatibility(context.Context) (mediaapi.Compatibility, error) {
	if b.compat.ServiceID == "" {
		return mediaapi.Compatibility{
			ServiceID: mediaapi.ServiceID, APIVersion: mediaapi.Version,
			CompatibilityMajor: mediaapi.CompatibilityMajor, MinimumClientMajor: 1,
			ChainID: 420, Network: "testnet",
		}, nil
	}
	return b.compat, nil
}

func newSDKServer(t *testing.T, backend mediaapi.Backend) *httptest.Server {
	t.Helper()
	server, err := mediaapi.NewServer(backend)
	if err != nil {
		t.Fatal(err)
	}
	return httptest.NewServer(server.Handler())
}

func newClientFor(t *testing.T, baseURL string) *Client {
	t.Helper()
	client, err := New(Config{
		BaseURL: baseURL, ExpectedChainID: 420, ExpectedNetwork: "testnet",
	})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func TestClientTypedPaginationAndCapabilities(t *testing.T) {
	ts := newSDKServer(t, &backendFake{})
	defer ts.Close()
	client := newClientFor(t, ts.URL)

	caps, err := client.Capabilities(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if caps.ServiceID != mediaapi.ServiceID || caps.APIVersion != mediaapi.Version {
		t.Fatalf("caps=%+v", caps)
	}
	page, err := client.Assets(context.Background(), "", 25)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != "asset-1" {
		t.Fatalf("page=%+v", page)
	}
	if _, err := client.Assets(context.Background(), "", 0); err == nil {
		t.Fatal("expected invalid page bound")
	}
}

func TestClientRejectsInsecureNonLoopbackEndpoint(t *testing.T) {
	_, err := New(Config{
		BaseURL: "http://example.com", ExpectedChainID: 420, ExpectedNetwork: "testnet",
	})
	if err == nil {
		t.Fatal("expected HTTPS policy error")
	}
}

func TestAuthorityWritesFailClosedOnChainMismatch(t *testing.T) {
	backend := &backendFake{compat: mediaapi.Compatibility{
		ServiceID: mediaapi.ServiceID, APIVersion: mediaapi.Version,
		CompatibilityMajor: mediaapi.CompatibilityMajor, MinimumClientMajor: 1,
		ChainID: 421, Network: "testnet",
	}}
	ts := newSDKServer(t, backend)
	defer ts.Close()
	client := newClientFor(t, ts.URL)

	_, err := client.PrepareUpload(context.Background(), mediaapi.PrepareUploadRequest{ID: "asset-1"}, "idem-1")
	if err == nil {
		t.Fatal("expected chain mismatch")
	}
	var sdkErr *Error
	if !errors.As(err, &sdkErr) || sdkErr.Kind != ErrorCompatibility {
		t.Fatalf("err=%T %v", err, err)
	}
}

type signerFake struct {
	message string
}

func (s *signerFake) Sign(_ context.Context, message string) (string, error) {
	s.message = message
	return "0xsigned", nil
}

func TestWalletSigningIsExternalHandoffOnly(t *testing.T) {
	ts := newSDKServer(t, &backendFake{})
	defer ts.Close()
	client := newClientFor(t, ts.URL)
	signer := &signerFake{}
	req := mediaapi.SigningIntentRequest{
		Wallet:  "0x1111111111111111111111111111111111111111",
		ChainID: 420, Network: "testnet", Action: "publish",
		ResourceID: "asset-1", PayloadHash: "0xabc",
	}
	signed, err := client.PrepareAndSign(context.Background(), req, "sign-1", signer)
	if err != nil {
		t.Fatal(err)
	}
	if signer.message != "sign-this-message" || signed.Signature != "0xsigned" ||
		signed.Intent.Domain != mediaapi.SigningDomain {
		t.Fatalf("signed=%+v message=%q", signed, signer.message)
	}
}

type discoveryFake struct {
	endpoint ServiceEndpoint
	err      error
	asked    string
}

func (d *discoveryFake) Resolve(_ context.Context, serviceID string) (ServiceEndpoint, error) {
	d.asked = serviceID
	return d.endpoint, d.err
}

func TestCanonicalServiceDiscoveryUsesMediaServiceID(t *testing.T) {
	ts := newSDKServer(t, &backendFake{})
	defer ts.Close()
	discovery := &discoveryFake{endpoint: ServiceEndpoint{
		ServiceID: mediaapi.ServiceID, BaseURL: ts.URL, ChainID: 420, Network: "testnet",
	}}
	client, err := Discover(context.Background(), discovery, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if discovery.asked != mediaapi.ServiceID {
		t.Fatalf("asked=%q", discovery.asked)
	}
	if _, err := client.Compatibility(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestSigningIntentRejectsRequestedNetworkMismatchBeforeTransport(t *testing.T) {
	ts := newSDKServer(t, &backendFake{})
	defer ts.Close()
	client := newClientFor(t, ts.URL)
	_, err := client.SigningIntent(context.Background(), mediaapi.SigningIntentRequest{
		Wallet:  "0x1111111111111111111111111111111111111111",
		ChainID: 420, Network: "mainnet", Action: "publish",
		ResourceID: "asset-1", PayloadHash: "0xabc",
	}, "sign-2")
	if err == nil {
		t.Fatal("expected request network mismatch")
	}
}


type tokenProvider string

func (p tokenProvider) Token(context.Context) (string, error) { return string(p), nil }

func TestClientAttachesEphemeralSessionToken(t *testing.T) {
	var seen string
	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		seen = req.Header.Get("Authorization")
		body := `{"version":"v1","data":{"items":[],"next_cursor":""},"rate_limit":{"limit":120,"remaining":119,"reset_at":"2026-10-06T20:31:00Z"}}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{"Content-Type":[]string{"application/json"}},
			Body: io.NopCloser(strings.NewReader(body)),
			Request: req,
		}, nil
	})
	client, err := New(Config{
		BaseURL: "https://media.example.invalid",
		HTTPClient: &http.Client{Transport: rt},
		ExpectedChainID: 420,
		ExpectedNetwork: "testnet",
		Session: tokenProvider("session-token"),
	})
	if err != nil { t.Fatal(err) }
	if _, err := client.Assets(context.Background(), "", 10); err != nil { t.Fatal(err) }
	if seen != "Bearer session-token" { t.Fatalf("authorization=%q", seen) }
}

func TestModerationTypesRemainPartOfTypedSDKSurface(t *testing.T) {
	_ = mediasecurity.Report{ID:"report-1", ReporterRef:"CREATOR", TargetKind:"MediaAsset", TargetID:"asset-1", Reason:"abuse"}
	_ = mediasecurity.Decision{ID:"decision-1", ReportID:"report-1", ModeratorRef:"MODERATOR", Action:mediasecurity.ActionHide, Reason:"review"}
	_ = mediasecurity.Appeal{ID:"appeal-1", DecisionID:"decision-1", AppellantRef:"CREATOR", Reason:"licensed"}
}
