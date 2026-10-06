package mail

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func walletHTTPHandler(authority *walletActionAuthorityStub) HTTPHandler {
	svc := NewWalletActionService(authority)
	svc.Now = walletTestNow
	return HTTPHandler{
		Service:       &Service{},
		WalletActions: svc,
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func performWalletRequest(t *testing.T, h HTTPHandler, method, path, actor string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	if actor != "" {
		req.Header.Set("X-Test-Actor", actor)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPWalletActionPrepareAndVerify(t *testing.T) {
	req := validTransactionRequest()
	authority := &walletActionAuthorityStub{
		handoff: validTransactionHandoff(req),
		verify: WalletVerification{
			HandoffID: "handoff-1", Kind: WalletVerifyTransaction, Identity: "alice.420", ChainID: 420,
			Account: "0x1111111111111111111111111111111111111111", Verified: true, Canonical: true,
			Finalized: true, TxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			VerifiedAt: walletTestNow(), NonCustodial: true,
		},
	}
	h := walletHTTPHandler(authority)

	rec := performWalletRequest(t, h, http.MethodPost, "/v1/wallet/actions", "alice.420", req)
	if rec.Code != http.StatusOK {
		t.Fatalf("prepare status=%d body=%s", rec.Code, rec.Body.String())
	}
	var handoff WalletHandoff
	if err := json.Unmarshal(rec.Body.Bytes(), &handoff); err != nil {
		t.Fatal(err)
	}
	if handoff.ID != "handoff-1" || !handoff.NonCustodial || !handoff.RequiresApproval {
		t.Fatalf("unexpected handoff: %+v", handoff)
	}

	verify := WalletVerificationRequest{Kind: WalletVerifyTransaction, HandoffID: handoff.ID, Evidence: "canonical-rpc-evidence"}
	rec = performWalletRequest(t, h, http.MethodPost, "/v1/wallet/verifications", "alice.420", verify)
	if rec.Code != http.StatusOK {
		t.Fatalf("verify status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out WalletVerification
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if !out.Verified || !out.Canonical || !out.Finalized {
		t.Fatalf("unexpected verification: %+v", out)
	}
}

func TestHTTPWalletActionsRequireAuthentication(t *testing.T) {
	req := validTransactionRequest()
	authority := &walletActionAuthorityStub{handoff: validTransactionHandoff(req)}
	h := walletHTTPHandler(authority)
	rec := performWalletRequest(t, h, http.MethodPost, "/v1/wallet/actions", "", req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(authority.calls) != 0 {
		t.Fatalf("unauthenticated request reached authority: %+v", authority.calls)
	}
}

func TestHTTPWalletActionsRejectSecretFields(t *testing.T) {
	req := validTransactionRequest()
	authority := &walletActionAuthorityStub{handoff: validTransactionHandoff(req)}
	h := walletHTTPHandler(authority)
	for _, body := range []string{
		`{"kind":"TRANSACTION","chain_id":420,"account":"0x1111111111111111111111111111111111111111","target":"0x2222222222222222222222222222222222222222","value_wei":"0","calldata":"0x1234","explanation":"x","expires_at":"2023-11-14T22:18:20Z","private_key":"secret"}`,
		`{"kind":"MESSAGE_SIGNATURE","chain_id":420,"account":"0x1111111111111111111111111111111111111111","payload_digest":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","explanation":"x","expires_at":"2023-11-14T22:18:20Z","seed_phrase":"secret"}`,
	} {
		httpReq := httptest.NewRequest(http.MethodPost, "/v1/wallet/actions", bytes.NewBufferString(body))
		httpReq.Header.Set("X-Test-Actor", "alice.420")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httpReq)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
		}
	}
	if len(authority.calls) != 0 {
		t.Fatalf("secret-bearing request reached authority: %+v", authority.calls)
	}
}

func TestHTTPWalletActionsFailClosedOnMutatedAuthorityResult(t *testing.T) {
	req := validTransactionRequest()
	handoff := validTransactionHandoff(req)
	handoff.Target = "0x3333333333333333333333333333333333333333"
	authority := &walletActionAuthorityStub{handoff: handoff}
	h := walletHTTPHandler(authority)
	rec := performWalletRequest(t, h, http.MethodPost, "/v1/wallet/actions", "alice.420", req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPWalletVerificationDoesNotAcceptTransportOnlyEvidence(t *testing.T) {
	authority := &walletActionAuthorityStub{
		verify: WalletVerification{
			HandoffID: "handoff-1", Kind: WalletVerifyTransaction, Identity: "alice.420", ChainID: 420,
			Account: "0x1111111111111111111111111111111111111111", Verified: true, Canonical: false,
			TxHash:     "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			VerifiedAt: walletTestNow(), NonCustodial: true,
		},
	}
	h := walletHTTPHandler(authority)
	rec := performWalletRequest(t, h, http.MethodPost, "/v1/wallet/verifications", "alice.420",
		WalletVerificationRequest{Kind: WalletVerifyTransaction, HandoffID: "handoff-1", Evidence: "wallet-submission-ack"})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPWalletActionsRejectWrongMethods(t *testing.T) {
	authority := &walletActionAuthorityStub{}
	h := walletHTTPHandler(authority)
	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/wallet/actions"},
		{http.MethodGet, "/v1/wallet/verifications"},
	} {
		rec := performWalletRequest(t, h, tc.method, tc.path, "alice.420", nil)
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s %s status=%d body=%s", tc.method, tc.path, rec.Code, rec.Body.String())
		}
	}
	if len(authority.calls) != 0 {
		t.Fatalf("wrong-method request reached authority: %+v", authority.calls)
	}
}
