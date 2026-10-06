package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

type discordWalletAuthorityStub struct {
	prepareReq WalletActionRequest
	verifyReq  WalletVerificationRequest
	handoffID  string
	err        error
}

func (s *discordWalletAuthorityStub) PrepareWalletAction(_ context.Context, actor string, req WalletActionRequest) (WalletHandoff, error) {
	if s.err != nil {
		return WalletHandoff{}, s.err
	}
	s.prepareReq = req
	id := s.handoffID
	if id == "" {
		id = "discord-wallet-handoff-1"
	}
	return WalletHandoff{
		ID: id, Kind: req.Kind, Identity: actor, ChainID: req.ChainID, Account: req.Account,
		PayloadDigest: req.PayloadDigest, Explanation: req.Explanation, ExpiresAt: req.ExpiresAt,
		AuthorizationEpoch: 9, NonCustodial: true, RequiresApproval: true,
	}, nil
}

func (s *discordWalletAuthorityStub) VerifyWalletEvidence(_ context.Context, actor string, req WalletVerificationRequest) (WalletVerification, error) {
	if s.err != nil {
		return WalletVerification{}, s.err
	}
	s.verifyReq = req
	return WalletVerification{
		HandoffID: req.HandoffID, Kind: WalletVerifySignature, Identity: actor,
		Account: s.prepareReq.Account, Verified: true, Canonical: true,
		VerifiedAt: walletTestNow().Add(time.Minute), NonCustodial: true,
	}, nil
}

func discordWalletHarness(store MailStore, authority WalletActionAuthority) *DiscordWalletVerificationService {
	wallet := NewWalletActionService(authority)
	wallet.Now = walletTestNow
	svc := NewDiscordWalletVerificationService(wallet, store)
	svc.Now = walletTestNow
	return svc
}

func validDiscordWalletChallengeRequest() DiscordWalletChallengeRequest {
	return DiscordWalletChallengeRequest{
		ConnectionID: "discord:123456789012345678",
		ChainID:      420,
		Account:      "0x1111111111111111111111111111111111111111",
		ExpiresAt:    walletTestNow().Add(5 * time.Minute),
	}
}

func TestDiscordWalletChallengeBindsDiscordAndWalletIdentity(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	svc := discordWalletHarness(NewMemoryStore(), authority)
	req := validDiscordWalletChallengeRequest()
	challenge, err := svc.Challenge(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if challenge.ConnectionID != req.ConnectionID || challenge.DiscordUserID != "123456789012345678" ||
		challenge.ChainID != req.ChainID || !sameAddress(challenge.Account, req.Account) ||
		!validDigest(challenge.PayloadDigest) || !challenge.NonCustodial || !challenge.RequiresWallet {
		t.Fatalf("unexpected challenge: %+v", challenge)
	}
	if authority.prepareReq.Kind != WalletActionMessageSignature ||
		!stringsEqualFold(authority.prepareReq.PayloadDigest, challenge.PayloadDigest) {
		t.Fatalf("wallet handoff not bound to challenge: %+v", authority.prepareReq)
	}
}

func TestDiscordWalletChallengeDigestChangesAcrossBindings(t *testing.T) {
	base := validDiscordWalletChallengeRequest()
	d1 := discordWalletChallengeDigest("alice.420", base.ConnectionID, "123456789012345678", base.ChainID, base.Account, base.ExpiresAt)
	d2 := discordWalletChallengeDigest("alice.420", "discord:223456789012345678", "223456789012345678", base.ChainID, base.Account, base.ExpiresAt)
	d3 := discordWalletChallengeDigest("alice.420", base.ConnectionID, "123456789012345678", 421, base.Account, base.ExpiresAt)
	if d1 == d2 || d1 == d3 {
		t.Fatal("challenge domain binding collision")
	}
}

func TestDiscordWalletVerificationUsesCanonicalWalletAuthority(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	svc := discordWalletHarness(NewMemoryStore(), authority)
	challenge, err := svc.Challenge(context.Background(), "alice.420", validDiscordWalletChallengeRequest())
	if err != nil {
		t.Fatal(err)
	}
	out, err := svc.Verify(context.Background(), "alice.420", DiscordWalletVerificationRequest{
		ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "canonical-signature-evidence",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !out.Verified || !out.Canonical || !out.NonCustodial || out.DiscordUserID != challenge.DiscordUserID ||
		!sameAddress(out.Account, challenge.Account) {
		t.Fatalf("unexpected verification: %+v", out)
	}
	if authority.verifyReq.Kind != WalletVerifySignature || authority.verifyReq.HandoffID != challenge.HandoffID {
		t.Fatalf("wrong wallet verification request: %+v", authority.verifyReq)
	}
}

func TestDiscordWalletVerificationIsReplaySafeAfterSuccess(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	svc := discordWalletHarness(NewMemoryStore(), authority)
	challenge, _ := svc.Challenge(context.Background(), "alice.420", validDiscordWalletChallengeRequest())
	req := DiscordWalletVerificationRequest{ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "proof"}
	first, err := svc.Verify(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	authority.err = errors.New("wallet should not be called again")
	second, err := svc.Verify(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if first.HandoffID != second.HandoffID || !second.Verified {
		t.Fatalf("replay result drifted: first=%+v second=%+v", first, second)
	}
}

func TestDiscordWalletVerificationRejectsCrossIdentityConnectionAndExpiry(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	svc := discordWalletHarness(NewMemoryStore(), authority)
	challenge, _ := svc.Challenge(context.Background(), "alice.420", validDiscordWalletChallengeRequest())
	for _, tc := range []struct {
		actor, connection string
	}{
		{"mallory.420", challenge.ConnectionID},
		{"alice.420", "discord:223456789012345678"},
	} {
		_, err := svc.Verify(context.Background(), tc.actor, DiscordWalletVerificationRequest{
			ConnectionID: tc.connection, HandoffID: challenge.HandoffID, Evidence: "proof",
		})
		if !errors.Is(err, ErrDiscordWalletConflict) {
			t.Fatalf("cross-binding verification accepted: actor=%q conn=%q err=%v", tc.actor, tc.connection, err)
		}
	}
	svc.Now = func() time.Time { return challenge.ExpiresAt.Add(time.Second) }
	_, err := svc.Verify(context.Background(), "alice.420", DiscordWalletVerificationRequest{
		ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "proof",
	})
	if !errors.Is(err, ErrDiscordWalletConflict) {
		t.Fatalf("expired challenge accepted: %v", err)
	}
}

func TestDiscordWalletChallengeRejectsMalformedOrOverlongTTL(t *testing.T) {
	base := validDiscordWalletChallengeRequest()
	cases := []func(*DiscordWalletChallengeRequest){
		func(r *DiscordWalletChallengeRequest) { r.ConnectionID = "bad" },
		func(r *DiscordWalletChallengeRequest) { r.ChainID = 0 },
		func(r *DiscordWalletChallengeRequest) { r.Account = "bad" },
		func(r *DiscordWalletChallengeRequest) { r.ExpiresAt = walletTestNow() },
		func(r *DiscordWalletChallengeRequest) {
			r.ExpiresAt = walletTestNow().Add(MaxDiscordWalletChallengeTTL + time.Second)
		},
	}
	for _, mutate := range cases {
		req := base
		mutate(&req)
		authority := &discordWalletAuthorityStub{}
		svc := discordWalletHarness(NewMemoryStore(), authority)
		if _, err := svc.Challenge(context.Background(), "alice.420", req); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid challenge accepted: %+v err=%v", req, err)
		}
		if !authority.prepareReq.ExpiresAt.IsZero() {
			t.Fatal("invalid challenge reached wallet authority")
		}
	}
}

func TestDiscordWalletVerificationRejectsNonCanonicalOrWrongAccount(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	store := NewMemoryStore()
	svc := discordWalletHarness(store, authority)
	challenge, _ := svc.Challenge(context.Background(), "alice.420", validDiscordWalletChallengeRequest())

	bad := &walletActionAuthorityStub{verify: WalletVerification{
		HandoffID: challenge.HandoffID, Kind: WalletVerifySignature, Identity: "alice.420",
		Account: "0x2222222222222222222222222222222222222222", Verified: true, Canonical: true,
		VerifiedAt: walletTestNow().Add(time.Minute), NonCustodial: true,
	}}
	badSvc := discordWalletHarness(store, bad)
	_, err := badSvc.Verify(context.Background(), "alice.420", DiscordWalletVerificationRequest{
		ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "proof",
	})
	if !errors.Is(err, ErrWalletInvalidResult) {
		t.Fatalf("wrong wallet account accepted: %v", err)
	}
}

func TestDiscordWalletVerificationPersistsAcrossRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail.json")
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	authority := &discordWalletAuthorityStub{}
	svc := discordWalletHarness(store, authority)
	challenge, err := svc.Challenge(context.Background(), "alice.420", validDiscordWalletChallengeRequest())
	if err != nil {
		t.Fatal(err)
	}

	reopened, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	svc2 := discordWalletHarness(reopened, authority)
	out, err := svc2.Verify(context.Background(), "alice.420", DiscordWalletVerificationRequest{
		ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "proof",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !out.Verified {
		t.Fatalf("verification did not survive restart: %+v", out)
	}
}

func discordWalletHTTPHandler(t *testing.T, authority WalletActionAuthority) HTTPHandler {
	t.Helper()
	store := NewMemoryStore()
	wallet := NewWalletActionService(authority)
	wallet.Now = walletTestNow
	discordWallet := NewDiscordWalletVerificationService(wallet, store)
	discordWallet.Now = walletTestNow
	return HTTPHandler{
		Service:       NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, store),
		WalletActions: wallet,
		DiscordWallet: discordWallet,
		Authenticate:  func(r *http.Request) (string, error) { return r.Header.Get("X-Test-Actor"), nil },
	}
}

func TestHTTPDiscordWalletChallengeAndVerify(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	h := discordWalletHTTPHandler(t, authority)
	raw, _ := json.Marshal(validDiscordWalletChallengeRequest())
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/wallet/challenge", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("challenge status=%d body=%s", rec.Code, rec.Body.String())
	}
	var challenge DiscordWalletChallenge
	if err := json.Unmarshal(rec.Body.Bytes(), &challenge); err != nil {
		t.Fatal(err)
	}
	verifyRaw, _ := json.Marshal(DiscordWalletVerificationRequest{
		ConnectionID: challenge.ConnectionID, HandoffID: challenge.HandoffID, Evidence: "proof",
	})
	req = httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/wallet/verify", bytes.NewReader(verifyRaw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("verify status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPDiscordWalletRejectsSecretFields(t *testing.T) {
	authority := &discordWalletAuthorityStub{}
	h := discordWalletHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/wallet/challenge", bytes.NewBufferString(
		`{"connection_id":"discord:123456789012345678","chain_id":420,"account":"0x1111111111111111111111111111111111111111","expires_at":"2023-11-14T22:18:20Z","private_key":"secret"}`))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func stringsEqualFold(a, b string) bool {
	return len(a) == len(b) && bytes.EqualFold([]byte(a), []byte(b))
}
