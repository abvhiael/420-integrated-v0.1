package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type config struct {
	BaseURL         string
	RequiredChainID uint64
	Timeout         time.Duration
}

type networkStatus struct {
	ChainID uint64 `json:"chainId"`
	Ready   bool   `json:"ready"`
}

type readinessResponse struct {
	Ready  bool          `json:"ready"`
	Status networkStatus `json:"status"`
}

type healthResponse struct {
	Status             string `json:"status"`
	DataSource         string `json:"dataSource"`
	CanonicalAuthority bool   `json:"canonicalAuthority"`
}

type capabilitiesResponse struct {
	DataSource         string   `json:"dataSource"`
	CanonicalAuthority bool     `json:"canonicalAuthority"`
	Qualification      string   `json:"qualification"`
	Endpoints          []string `json:"endpoints"`
}

type smokeResult struct {
	Service               string `json:"service"`
	Phase                 string `json:"phase"`
	BaseURL               string `json:"baseUrl"`
	RequiredChainID       uint64 `json:"requiredChainId"`
	Status                string `json:"status"`
	CanonicalAuthority    bool   `json:"canonicalAuthority"`
	DataSource            string `json:"dataSource"`
	ConsumerQualification string `json:"consumerQualification"`
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()
	if err := qualify(ctx, &http.Client{Timeout: cfg.Timeout}, cfg); err != nil {
		fatal(err)
	}
	out, _ := json.Marshal(smokeResult{
		Service:               "420Explorer",
		Phase:                 "EXP-7.1",
		BaseURL:               cfg.BaseURL,
		RequiredChainID:       cfg.RequiredChainID,
		Status:                "QUALIFIED",
		CanonicalAuthority:    false,
		DataSource:            "420Indexer",
		ConsumerQualification: "QUALIFIED_INDEXER_API_CONSUMER",
	})
	fmt.Println(string(out))
}

func loadConfig(getenv func(string) string) (config, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(getenv("EXPLORER_SMOKE_URL")), "/")
	if baseURL == "" {
		return config{}, errors.New("EXPLORER_SMOKE_URL is required")
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return config{}, errors.New("EXPLORER_SMOKE_URL must be an absolute http(s) URL")
	}
	cfg := config{BaseURL: baseURL, RequiredChainID: 420, Timeout: 15 * time.Second}
	if raw := strings.TrimSpace(getenv("EXPLORER_SMOKE_CHAIN_ID")); raw != "" {
		chainID, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || chainID == 0 {
			return config{}, errors.New("EXPLORER_SMOKE_CHAIN_ID must be a non-zero uint64")
		}
		cfg.RequiredChainID = chainID
	}
	if raw := strings.TrimSpace(getenv("EXPLORER_SMOKE_TIMEOUT")); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil || d <= 0 {
			return config{}, errors.New("EXPLORER_SMOKE_TIMEOUT must be a positive duration")
		}
		cfg.Timeout = d
	}
	return cfg, nil
}

func qualify(ctx context.Context, client *http.Client, cfg config) error {
	if client == nil {
		return errors.New("http client required")
	}
	var health healthResponse
	if err := getJSON(ctx, client, cfg.BaseURL+"/v1/health", &health); err != nil {
		return fmt.Errorf("health: %w", err)
	}
	if health.Status != "LIVE" || health.DataSource != "420Indexer" || health.CanonicalAuthority {
		return fmt.Errorf("health contract mismatch: %+v", health)
	}

	var ready readinessResponse
	if err := getJSON(ctx, client, cfg.BaseURL+"/v1/ready", &ready); err != nil {
		return fmt.Errorf("readiness: %w", err)
	}
	if !ready.Ready || !ready.Status.Ready || ready.Status.ChainID != cfg.RequiredChainID {
		return fmt.Errorf("readiness contract mismatch: ready=%t statusReady=%t chainId=%d", ready.Ready, ready.Status.Ready, ready.Status.ChainID)
	}

	var status networkStatus
	if err := getJSON(ctx, client, cfg.BaseURL+"/v1/status", &status); err != nil {
		return fmt.Errorf("status: %w", err)
	}
	if !status.Ready || status.ChainID != cfg.RequiredChainID {
		return fmt.Errorf("status contract mismatch: ready=%t chainId=%d", status.Ready, status.ChainID)
	}

	var capabilities capabilitiesResponse
	if err := getJSON(ctx, client, cfg.BaseURL+"/v1/capabilities", &capabilities); err != nil {
		return fmt.Errorf("capabilities: %w", err)
	}
	if capabilities.DataSource != "420Indexer" || capabilities.CanonicalAuthority || capabilities.Qualification != "QUALIFIED_INDEXER_API_CONSUMER" || len(capabilities.Endpoints) < 10 {
		return fmt.Errorf("capabilities contract mismatch: %+v", capabilities)
	}
	return nil
}

func getJSON(ctx context.Context, client *http.Client, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	if resp.Header.Get("X-420-Service") != "420Explorer" || resp.Header.Get("X-420-Data-Source") != "420Indexer" || resp.Header.Get("X-420-Canonical-Authority") != "false" || resp.Header.Get("X-420-Consumer-Qualification") != "QUALIFIED_INDEXER_API_CONSUMER" {
		return errors.New("qualified Explorer provenance headers missing or invalid")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return err
	}
	return nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
