package runtime

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeProbe struct {
	chainID uint64
	chainErr error
	codeErr  error
}

func (f fakeProbe) ChainID(context.Context) (uint64, error) {
	return f.chainID, f.chainErr
}

func (f fakeProbe) CanonicalBytecodeAvailable(context.Context) error {
	return f.codeErr
}

func validConfig() Config {
	return Config{
		ChainID:       420,
		RPCURL:        "http://127.0.0.1:8545",
		CompilerCache: "/tmp/420verify/compilers",
		EvidenceStore: "/tmp/420verify/evidence",
		ListenAddr:    "127.0.0.1:8420",
	}
}

func TestConfigValidateFailsClosed(t *testing.T) {
	cases := []struct {
		name string
		mutate func(*Config)
	}{
		{"zero chain id", func(c *Config) { c.ChainID = 0 }},
		{"missing rpc", func(c *Config) { c.RPCURL = "" }},
		{"bad rpc scheme", func(c *Config) { c.RPCURL = "file:///tmp/node.ipc" }},
		{"missing compiler cache", func(c *Config) { c.CompilerCache = "" }},
		{"missing evidence store", func(c *Config) { c.EvidenceStore = "" }},
		{"missing listener", func(c *Config) { c.ListenAddr = "" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := validConfig()
			tc.mutate(&cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatal("expected invalid configuration to be rejected")
			}
		})
	}
}

func TestServiceRejectsWrongChain(t *testing.T) {
	svc, err := NewService(validConfig(), fakeProbe{chainID: 421})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Qualify(context.Background()); err == nil || !strings.Contains(err.Error(), "wrong chain") {
		t.Fatalf("expected wrong-chain failure, got %v", err)
	}
	assertReadyStatus(t, svc, http.StatusServiceUnavailable)
}

func TestServiceRejectsUnavailableCanonicalBytecode(t *testing.T) {
	svc, err := NewService(validConfig(), fakeProbe{chainID: 420, codeErr: errors.New("rpc unavailable")})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Qualify(context.Background()); err == nil || !strings.Contains(err.Error(), "canonical bytecode unavailable") {
		t.Fatalf("expected canonical-bytecode failure, got %v", err)
	}
	assertReadyStatus(t, svc, http.StatusServiceUnavailable)
}

func TestServiceBecomesReadyOnlyAfterQualification(t *testing.T) {
	svc, err := NewService(validConfig(), fakeProbe{chainID: 420})
	if err != nil {
		t.Fatal(err)
	}
	assertReadyStatus(t, svc, http.StatusServiceUnavailable)
	if err := svc.Qualify(context.Background()); err != nil {
		t.Fatal(err)
	}
	assertReadyStatus(t, svc, http.StatusOK)
}

func TestHealthDoesNotClaimCanonicalAuthority(t *testing.T) {
	svc, err := NewService(validConfig(), fakeProbe{chainID: 420})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()
	svc.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("unexpected health status %d", res.Code)
	}
	if !strings.Contains(res.Body.String(), `"canonical":false`) {
		t.Fatalf("health surface must explicitly remain non-canonical: %s", res.Body.String())
	}
}

func assertReadyStatus(t *testing.T, svc *Service, want int) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()
	svc.Handler().ServeHTTP(res, req)
	if res.Code != want {
		t.Fatalf("ready status=%d want=%d body=%s", res.Code, want, res.Body.String())
	}
}
