package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type HTTPIndexerProbe struct {
	base string
	client *http.Client
}

func NewHTTPIndexerProbe(base string, timeout time.Duration) (*HTTPIndexerProbe, error) {
	if err := requireURL("indexer url", base); err != nil { return nil, err }
	if timeout <= 0 { return nil, fmt.Errorf("timeout must be positive") }
	return &HTTPIndexerProbe{base: strings.TrimRight(base,"/"), client:&http.Client{Timeout:timeout}}, nil
}

func (p *HTTPIndexerProbe) get(ctx context.Context, path string, out any) error {
	u, _ := url.Parse(p.base + path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil { return err }
	resp, err := p.client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 { return fmt.Errorf("unexpected status %d", resp.StatusCode) }
	return json.NewDecoder(resp.Body).Decode(out)
}

func (p *HTTPIndexerProbe) ChainID(ctx context.Context) (uint64, error) {
	var body struct { ChainID any `json:"chain_id"` }
	if err := p.get(ctx, "/readyz", &body); err != nil { return 0, err }
	switch v := body.ChainID.(type) {
	case float64: return uint64(v), nil
	case string:
		return strconv.ParseUint(strings.TrimSpace(v), 0, 64)
	default: return 0, fmt.Errorf("chain_id missing or invalid")
	}
}

func (p *HTTPIndexerProbe) Ready(ctx context.Context) error {
	var body struct { Ready bool `json:"ready"` }
	if err := p.get(ctx, "/readyz", &body); err != nil { return err }
	if !body.Ready { return fmt.Errorf("indexer not ready") }
	return nil
}

func (p *HTTPIndexerProbe) ObservedAt(ctx context.Context) (time.Time, error) {
	var body struct { ObservedAt string `json:"observed_at"`; UpdatedAt string `json:"updated_at"` }
	if err := p.get(ctx, "/status", &body); err != nil { return time.Time{}, err }
	raw := body.ObservedAt
	if raw == "" { raw = body.UpdatedAt }
	if raw == "" { return time.Time{}, fmt.Errorf("observation timestamp missing") }
	return time.Parse(time.RFC3339, raw)
}
