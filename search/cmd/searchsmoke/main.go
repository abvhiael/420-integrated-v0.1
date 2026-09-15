package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type config struct {
	BaseURL string
	Timeout time.Duration
	Query   string
}

type operational struct {
	OK              bool   `json:"ok"`
	State           string `json:"state"`
	IndexedHeight   uint64 `json:"indexedHeight"`
	FinalizedHeight uint64 `json:"finalizedHeight"`
}

type capabilities struct {
	API              string   `json:"api"`
	QuerySchema      string   `json:"querySchema"`
	CursorSchema     string   `json:"cursorSchema"`
	MaxSearchResults int      `json:"maxSearchResults"`
	Endpoints        []string `json:"endpoints"`
}

type searchResponse struct {
	Results []struct {
		Domain string `json:"domain"`
		Provenance struct {
			Source    string `json:"source"`
			Authority string `json:"authority"`
		} `json:"provenance"`
	} `json:"results"`
	Snapshot struct {
		IndexedHeight   uint64 `json:"indexedHeight"`
		FinalizedHeight uint64 `json:"finalizedHeight"`
	} `json:"snapshot"`
}

type smokeResult struct {
	Service            string `json:"service"`
	Phase              string `json:"phase"`
	BaseURL            string `json:"baseUrl"`
	Status             string `json:"status"`
	CanonicalAuthority bool   `json:"canonicalAuthority"`
	DirectRPC          bool   `json:"directRpc"`
	DataSource         string `json:"dataSource"`
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil { fatal(err) }
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()
	if err := qualify(ctx, &http.Client{Timeout: cfg.Timeout}, cfg); err != nil { fatal(err) }
	out, _ := json.Marshal(smokeResult{Service:"420Search", Phase:"SEARCH-9", BaseURL:cfg.BaseURL, Status:"QUALIFIED", CanonicalAuthority:false, DirectRPC:false, DataSource:"420Indexer"})
	fmt.Println(string(out))
}

func loadConfig(getenv func(string) string) (config, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(getenv("SEARCH_SMOKE_URL")), "/")
	if baseURL == "" { return config{}, errors.New("SEARCH_SMOKE_URL is required") }
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" { return config{}, errors.New("SEARCH_SMOKE_URL must be an absolute http(s) URL") }
	cfg := config{BaseURL:baseURL, Timeout:15*time.Second, Query:"420"}
	if raw := strings.TrimSpace(getenv("SEARCH_SMOKE_TIMEOUT")); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil || d <= 0 { return config{}, errors.New("SEARCH_SMOKE_TIMEOUT must be a positive duration") }
		cfg.Timeout = d
	}
	if raw := strings.TrimSpace(getenv("SEARCH_SMOKE_QUERY")); raw != "" { cfg.Query = raw }
	return cfg, nil
}

func qualify(ctx context.Context, client *http.Client, cfg config) error {
	if client == nil { return errors.New("http client required") }
	for _, path := range []string{"/v1/health", "/v1/readiness", "/v1/status"} {
		var op operational
		if err := getJSON(ctx, client, cfg.BaseURL+path, &op); err != nil { return fmt.Errorf("%s: %w", path, err) }
		if !op.OK || op.State != "ready" || op.IndexedHeight == 0 || op.FinalizedHeight > op.IndexedHeight {
			return fmt.Errorf("%s operational contract mismatch: %+v", path, op)
		}
	}
	var caps capabilities
	if err := getJSON(ctx, client, cfg.BaseURL+"/v1/capabilities", &caps); err != nil { return fmt.Errorf("capabilities: %w", err) }
	if caps.API != "420-search-http-v1" || caps.QuerySchema != "420-search-query-v1" || caps.CursorSchema != "420-search-cursor-v1" || caps.MaxSearchResults < 1 || len(caps.Endpoints) < 7 {
		return fmt.Errorf("capabilities contract mismatch: %+v", caps)
	}
	var result searchResponse
	endpoint := cfg.BaseURL+"/v1/search?q="+url.QueryEscape(cfg.Query)+"&limit=5"
	if err := getJSON(ctx, client, endpoint, &result); err != nil { return fmt.Errorf("search: %w", err) }
	if result.Snapshot.IndexedHeight == 0 || result.Snapshot.FinalizedHeight > result.Snapshot.IndexedHeight { return errors.New("search snapshot invalid") }
	for _, item := range result.Results {
		if strings.TrimSpace(item.Domain) == "" || strings.TrimSpace(item.Provenance.Source) == "" || strings.TrimSpace(item.Provenance.Authority) == "" {
			return errors.New("search result missing domain or provenance")
		}
	}
	return nil
}

func getJSON(ctx context.Context, client *http.Client, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil { return err }
	resp, err := client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { return fmt.Errorf("unexpected status %d", resp.StatusCode) }
	return json.NewDecoder(resp.Body).Decode(out)
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
