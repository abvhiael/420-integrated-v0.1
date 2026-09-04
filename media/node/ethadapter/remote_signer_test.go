package ethadapter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHTTPSignerSendsBearerAndReturnsHash(t *testing.T) {
	const tokenEnv = "MEDIA_SIGNER_TEST_TOKEN"
	if err := os.Setenv(tokenEnv, "secret-token"); err != nil { t.Fatal(err) }
	defer os.Unsetenv(tokenEnv)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret-token" { t.Fatalf("auth=%q", r.Header.Get("Authorization")) }
		var req signerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil { t.Fatal(err) }
		if req.To != "0x1111111111111111111111111111111111111111" { t.Fatalf("to=%q", req.To) }
		if req.Data != "0x12345678" { t.Fatalf("data=%q", req.Data) }
		_ = json.NewEncoder(w).Encode(signerResponse{TxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
	}))
	defer server.Close()

	signer, err := NewHTTPSigner(server.URL, tokenEnv, server.Client())
	if err != nil { t.Fatal(err) }
	hash, err := signer.SendTransaction(context.Background(), "0x1111111111111111111111111111111111111111", []byte{0x12, 0x34, 0x56, 0x78})
	if err != nil { t.Fatal(err) }
	if hash != "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" { t.Fatalf("hash=%q", hash) }
}

func TestHTTPSignerRejectsNonLoopbackHTTP(t *testing.T) {
	if _, err := NewHTTPSigner("http://example.com/sign", "TOKEN", nil); err == nil { t.Fatal("expected rejection") }
}

func TestHTTPSignerRejectsMissingToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer server.Close()
	signer, err := NewHTTPSigner(server.URL, "UNSET_420MEDIA_SIGNER_TOKEN", server.Client())
	if err != nil { t.Fatal(err) }
	if _, err := signer.SendTransaction(context.Background(), "0x1111111111111111111111111111111111111111", []byte{1,2,3,4}); err == nil { t.Fatal("expected missing token error") }
}

func TestHTTPSignerRejectsMalformedHash(t *testing.T) {
	const tokenEnv = "MEDIA_SIGNER_TEST_TOKEN_2"
	_ = os.Setenv(tokenEnv, "secret-token")
	defer os.Unsetenv(tokenEnv)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _ = json.NewEncoder(w).Encode(signerResponse{TxHash: "0xdeadbeef"}) }))
	defer server.Close()
	signer, err := NewHTTPSigner(server.URL, tokenEnv, server.Client())
	if err != nil { t.Fatal(err) }
	if _, err := signer.SendTransaction(context.Background(), "0x1111111111111111111111111111111111111111", []byte{1,2,3,4}); err == nil { t.Fatal("expected malformed hash error") }
}
