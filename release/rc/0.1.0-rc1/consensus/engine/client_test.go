package engine

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func verifyJWT(t *testing.T, token string, secret []byte) {
	t.Helper()
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatalf("jwt parts=%d", len(parts))
	}
	unsigned := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(unsigned))
	want := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if parts[2] != want {
		t.Fatal("bad jwt signature")
	}
}

func TestEngineCapabilityExchange(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		verifyJWT(t, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), secret)
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req["method"] != "engine_exchangeCapabilities" {
			t.Fatalf("method=%v", req["method"])
		}
		json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      req["id"],
			"result":  []string{"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3"},
		})
	}))
	defer s.Close()

	c, err := NewClient(s.URL, secret)
	if err != nil {
		t.Fatal(err)
	}
	got, err := c.ExchangeCapabilities(context.Background(), []string{
		"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("capabilities=%v", got)
	}
}

func TestJWTIssuedAt(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	c, _ := NewClient("http://127.0.0.1:8551", secret)
	token, err := c.jwtToken(time.Unix(1800000000, 0).UTC())
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	raw, _ := base64.RawURLEncoding.DecodeString(parts[1])
	var claims map[string]any
	if err := json.Unmarshal(raw, &claims); err != nil {
		t.Fatal(err)
	}
	if int64(claims["iat"].(float64)) != 1800000000 {
		t.Fatalf("iat=%v", claims["iat"])
	}
}
