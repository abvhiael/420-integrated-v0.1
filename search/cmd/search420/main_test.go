package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func env(values map[string]string) func(string) string { return func(key string) string { return values[key] } }

func TestLoadConfigRequiresIndexerURL(t *testing.T) {
	if _, err := loadConfig(env(nil)); err == nil { t.Fatal("expected SEARCH_INDEXER_URL requirement") }
}

func TestLoadConfigDefaultsAndOverrides(t *testing.T) {
	cfg, err := loadConfig(env(map[string]string{
		"SEARCH_INDEXER_URL":"http://indexer:8420",
		"SEARCH_LISTEN_ADDR":":9442",
		"SEARCH_CHAIN_ID":"420",
		"SEARCH_STALE_AFTER":"90s",
		"SEARCH_INDEXER_TIMEOUT":"4s",
		"SEARCH_SHUTDOWN_TIMEOUT":"7s",
		"SEARCH_PUBLIC_COMMONS_VISIBILITY":"public, discoverable,public",
	}))
	if err != nil { t.Fatal(err) }
	if cfg.ListenAddr != ":9442" || cfg.RequiredChainID != 420 { t.Fatalf("unexpected cfg %#v", cfg) }
	if cfg.StaleAfter != 90*time.Second || cfg.IndexerTimeout != 4*time.Second || cfg.ShutdownTimeout != 7*time.Second { t.Fatalf("unexpected durations %#v", cfg) }
	if len(cfg.PublicCommonsVisibility) != 2 || cfg.PublicCommonsVisibility[0] != "public" || cfg.PublicCommonsVisibility[1] != "discoverable" { t.Fatalf("visibility=%v", cfg.PublicCommonsVisibility) }
}

func TestLoadConfigRejectsInvalidValues(t *testing.T) {
	for key, value := range map[string]string{
		"SEARCH_CHAIN_ID":"0",
		"SEARCH_STALE_AFTER":"0s",
		"SEARCH_INDEXER_TIMEOUT":"nope",
		"SEARCH_SHUTDOWN_TIMEOUT":"-1s",
	} {
		values := map[string]string{"SEARCH_INDEXER_URL":"http://indexer:8420", key:value}
		if _, err := loadConfig(env(values)); err == nil { t.Fatalf("expected %s rejection", key) }
	}
}

func TestHTTPServerRoutesAPIAndEmbeddedWeb(t *testing.T) {
	cfg, err := loadConfig(env(map[string]string{"SEARCH_INDEXER_URL":"http://indexer.invalid:8420"}))
	if err != nil { t.Fatal(err) }
	server, err := newHTTPServer(cfg)
	if err != nil { t.Fatal(err) }

	web := httptest.NewRecorder()
	server.Handler.ServeHTTP(web, httptest.NewRequest(http.MethodGet, "/", nil))
	if web.Code != http.StatusOK || !strings.Contains(web.Body.String(), "420Search") { t.Fatalf("web status=%d body=%s", web.Code, web.Body.String()) }

	api := httptest.NewRecorder()
	server.Handler.ServeHTTP(api, httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil))
	if api.Code != http.StatusOK || !strings.Contains(api.Body.String(), "420-search-http-v1") { t.Fatalf("api status=%d body=%s", api.Code, api.Body.String()) }
}
