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
	registryErr error
}

func (f fakeProbe) ChainID(context.Context) (uint64, error) { return f.chainID, f.chainErr }
func (f fakeProbe) RegistryAvailable(context.Context) error { return f.registryErr }

func testConfig() Config {
	return Config{
		ChainID: 420,
		RPCURL: "http://127.0.0.1:8545",
		RegistryAddress: "0x1111111111111111111111111111111111111111",
		CatalogueStore: "./catalogue",
		ListenAddr: ":8426",
	}
}

func TestConfigValidate(t *testing.T) {
	cfg := testConfig()
	if err := cfg.Validate(); err != nil { t.Fatalf("valid config: %v", err) }
	cfg.RegistryAddress = "bad"
	if err := cfg.Validate(); err == nil { t.Fatal("expected invalid registry address") }
}

func TestQualifyReadyOnMatchingChainAndRegistry(t *testing.T) {
	s, err := NewService(testConfig(), fakeProbe{chainID: 420})
	if err != nil { t.Fatal(err) }
	if err := s.Qualify(context.Background()); err != nil { t.Fatal(err) }
	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	res := httptest.NewRecorder()
	s.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK { t.Fatalf("status=%d body=%s", res.Code, res.Body.String()) }
}

func TestQualifyFailsClosedOnWrongChain(t *testing.T) {
	s, err := NewService(testConfig(), fakeProbe{chainID: 1})
	if err != nil { t.Fatal(err) }
	if err := s.Qualify(context.Background()); err == nil || !strings.Contains(err.Error(), "wrong chain") { t.Fatalf("expected wrong-chain failure, got %v", err) }
}

func TestQualifyFailsClosedOnRegistryFailure(t *testing.T) {
	s, err := NewService(testConfig(), fakeProbe{chainID: 420, registryErr: errors.New("down")})
	if err != nil { t.Fatal(err) }
	if err := s.Qualify(context.Background()); err == nil || !strings.Contains(err.Error(), "registry unavailable") { t.Fatalf("expected registry failure, got %v", err) }
}

func TestHealthDeclaresNonCanonical(t *testing.T) {
	s, err := NewService(testConfig(), fakeProbe{chainID: 420})
	if err != nil { t.Fatal(err) }
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()
	s.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"canonical":false`) { t.Fatalf("unexpected response: %d %s", res.Code, res.Body.String()) }
}
