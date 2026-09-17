package runtime

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeProbe struct {
	chainID  uint64
	chainErr error
	readyErr error
}

func (f fakeProbe) ChainID(context.Context) (uint64, error) { return f.chainID, f.chainErr }
func (f fakeProbe) Ready(context.Context) error             { return f.readyErr }

func validConfig() Config {
	return Config{
		ChainID:        420,
		IndexerURL:     "https://indexer.example",
		ListenAddr:     ":8420",
		RequestTimeout: 2 * time.Second,
	}
}

func TestConfigValidation(t *testing.T) {
	cfg := validConfig()
	if err := cfg.Validate(); err != nil { t.Fatal(err) }

	bad := cfg
	bad.IndexerURL = "file:///tmp/indexer"
	if err := bad.Validate(); err == nil { t.Fatal("expected invalid indexer URL") }

	bad = cfg
	bad.RequestTimeout = 0
	if err := bad.Validate(); err == nil { t.Fatal("expected invalid timeout") }
}

func TestServiceFailsClosedUntilQualified(t *testing.T) {
	s, err := NewService(validConfig(), fakeProbe{chainID: 420})
	if err != nil { t.Fatal(err) }

	r := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusServiceUnavailable { t.Fatalf("ready before qualification = %d", w.Code) }

	if err := s.Qualify(context.Background()); err != nil { t.Fatal(err) }
	w = httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("ready after qualification = %d", w.Code) }
}

func TestServiceRejectsWrongChainAndIndexerFailure(t *testing.T) {
	s, err := NewService(validConfig(), fakeProbe{chainID: 1})
	if err != nil { t.Fatal(err) }
	if err := s.Qualify(context.Background()); err == nil { t.Fatal("expected wrong-chain failure") }

	s, err = NewService(validConfig(), fakeProbe{chainID: 420, readyErr: errors.New("down")})
	if err != nil { t.Fatal(err) }
	if err := s.Qualify(context.Background()); err == nil { t.Fatal("expected indexer readiness failure") }
}

func TestHealthIsNonCanonical(t *testing.T) {
	s, err := NewService(validConfig(), fakeProbe{chainID: 420})
	if err != nil { t.Fatal(err) }
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if w.Code != http.StatusOK { t.Fatalf("health status = %d", w.Code) }
	if got := w.Body.String(); got == "" || !containsAll(got, "420Notifications", "\"canonical\":false") {
		t.Fatalf("unexpected health body: %s", got)
	}
}

func TestHTTPIndexerProbe(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/identity":
			_, _ = w.Write([]byte(`{"chainId":420}`))
		case "/readyz":
			_, _ = w.Write([]byte(`{"ready":true}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	probe, err := NewHTTPIndexerProbe(server.URL, time.Second)
	if err != nil { t.Fatal(err) }
	chainID, err := probe.ChainID(context.Background())
	if err != nil { t.Fatal(err) }
	if chainID != 420 { t.Fatalf("chain id = %d", chainID) }
	if err := probe.Ready(context.Background()); err != nil { t.Fatal(err) }
}

func containsAll(s string, needles ...string) bool {
	for _, needle := range needles {
		if len(needle) == 0 || !contains(s, needle) { return false }
	}
	return true
}

func contains(s, needle string) bool {
	for i := 0; i+len(needle) <= len(s); i++ {
		if s[i:i+len(needle)] == needle { return true }
	}
	return false
}
