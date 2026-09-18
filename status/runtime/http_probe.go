package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	statussecurity "github.com/420integrated/420-integrated/status/security"
)

const maxProbeResponseBytes = 1 << 20

type HTTPIndexerProbe struct {
	base string
	client *http.Client
}

func NewHTTPIndexerProbe(base string, timeout time.Duration) (*HTTPIndexerProbe, error) {
	if err := requireURL("indexer url", base); err != nil { return nil, err }
	if timeout <= 0 { return nil, fmt.Errorf("timeout must be positive") }
	transport := &http.Transport{DialContext: safeDialContext(timeout)}
	client := &http.Client{
		Timeout: timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 { return fmt.Errorf("too many redirects") }
			return statussecurity.ValidateProbeURL(req.URL.String())
		},
	}
	return &HTTPIndexerProbe{base: strings.TrimRight(base,"/"), client:client}, nil
}

func safeDialContext(timeout time.Duration) func(context.Context, string, string) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: timeout}
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil { return nil, err }
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil { return nil, err }
		if len(ips) == 0 { return nil, fmt.Errorf("probe target resolved to no addresses") }
		for _, candidate := range ips {
			if !statussecurity.PublicIP(candidate.IP) { return nil, fmt.Errorf("probe target resolved to private or special-purpose address") }
		}
		return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	}
}

func (p *HTTPIndexerProbe) get(ctx context.Context, path string, out any) error {
	u, _ := url.Parse(p.base + path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil { return err }
	resp, err := p.client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 { return fmt.Errorf("unexpected status %d", resp.StatusCode) }
	payload, err := io.ReadAll(io.LimitReader(resp.Body, maxProbeResponseBytes+1))
	if err != nil { return err }
	if len(payload) > maxProbeResponseBytes { return fmt.Errorf("probe response exceeds %d bytes", maxProbeResponseBytes) }
	if err := json.Unmarshal(payload, out); err != nil { return err }
	return nil
}

func (p *HTTPIndexerProbe) ChainID(ctx context.Context) (uint64, error) {
	var body struct { ChainID any `json:"chain_id"` }
	if err := p.get(ctx, "/readyz", &body); err != nil { return 0, err }
	switch v := body.ChainID.(type) {
	case float64:
		if v <= 0 || v != float64(uint64(v)) { return 0, fmt.Errorf("chain_id missing or invalid") }
		return uint64(v), nil
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
