package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type HTTPIndexerProbe struct {
	baseURL string
	client  *http.Client
}

func NewHTTPIndexerProbe(baseURL string, timeout time.Duration) (*HTTPIndexerProbe, error) {
	cfg := Config{ChainID: 1, IndexerURL: baseURL, ListenAddr: "unused", RequestTimeout: timeout}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &HTTPIndexerProbe{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: timeout},
	}, nil
}

func (p *HTTPIndexerProbe) ChainID(ctx context.Context) (uint64, error) {
	var payload struct {
		ChainID uint64 `json:"chainId"`
	}
	if err := p.getJSON(ctx, "/v1/identity", &payload); err != nil {
		return 0, err
	}
	if payload.ChainID == 0 {
		return 0, fmt.Errorf("indexer returned zero chain id")
	}
	return payload.ChainID, nil
}

func (p *HTTPIndexerProbe) Ready(ctx context.Context) error {
	var payload struct {
		Ready bool `json:"ready"`
	}
	if err := p.getJSON(ctx, "/readyz", &payload); err != nil {
		return err
	}
	if !payload.Ready {
		return fmt.Errorf("indexer is not ready")
	}
	return nil
}

func (p *HTTPIndexerProbe) getJSON(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("indexer %s returned status %d", path, resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode indexer %s response: %w", path, err)
	}
	return nil
}
