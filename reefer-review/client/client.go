package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type Client struct {
	BaseURL string
	HTTP    *http.Client
}
type Publication map[string]any

func (c Client) do(ctx context.Context, method, path, actor string, in any, out any) error {
	base := strings.TrimRight(c.BaseURL, "/")
	if _, err := url.ParseRequestURI(base); err != nil {
		return err
	}
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, base+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if actor != "" {
		req.Header.Set("X-420-Actor", actor)
	}
	hc := c.HTTP
	if hc == nil {
		hc = http.DefaultClient
	}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("reefer review http %d: %s", resp.StatusCode, string(b))
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(out)
}
func (c Client) CreateDraft(ctx context.Context, actor string, req any) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPost, "/v1/publications", actor, req, &out)
	return out, err
}
func (c Client) Publish(ctx context.Context, actor, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPost, "/v1/publications/"+url.PathEscape(id)+"/publish", actor, nil, &out)
	return out, err
}
func (c Client) List(ctx context.Context, cursor string, limit int) (map[string]any, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	q.Set("limit", fmt.Sprint(limit))
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/publications?"+q.Encode(), "", nil, &out)
	return out, err
}
