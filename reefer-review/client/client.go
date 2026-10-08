package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type SessionTokenProvider interface {
	Token(context.Context) (string, error)
}

type SessionTokenProviderFunc func(context.Context) (string, error)

func (f SessionTokenProviderFunc) Token(ctx context.Context) (string, error) { return f(ctx) }

type Client struct {
	BaseURL string
	HTTP    *http.Client
	Session SessionTokenProvider
}

type Publication map[string]any

type authMode uint8

const (
	authNone authMode = iota
	authOptional
	authRequired
)

func (c Client) token(ctx context.Context, mode authMode) (string, error) {
	if mode == authNone {
		return "", nil
	}
	if c.Session == nil {
		if mode == authRequired {
			return "", errors.New("reefer review client: verified session required")
		}
		return "", nil
	}
	token, err := c.Session.Token(ctx)
	if err != nil {
		return "", err
	}
	token = strings.TrimSpace(token)
	if token == "" || strings.ContainsAny(token, " \t\r\n,") {
		if mode == authRequired {
			return "", errors.New("reefer review client: verified session required")
		}
		return "", nil
	}
	return token, nil
}

func (c Client) do(ctx context.Context, method, path string, mode authMode, in any, out any) error {
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
	token, err := c.token(ctx, mode)
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
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

func (c Client) Ready(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/readyz", authNone, nil, &out)
	return out, err
}

func (c Client) CreateDraft(ctx context.Context, req any) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPost, "/v1/publications", authRequired, req, &out)
	return out, err
}

func (c Client) GetPublication(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/publications/"+url.PathEscape(id), authOptional, nil, &out)
	return out, err
}

func (c Client) UpdatePublication(ctx context.Context, id string, req any) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPut, "/v1/publications/"+url.PathEscape(id), authRequired, req, &out)
	return out, err
}

func (c Client) Publish(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPost, "/v1/publications/"+url.PathEscape(id)+"/publish", authRequired, nil, &out)
	return out, err
}

func (c Client) Moderate(ctx context.Context, id, action, reason string) (map[string]any, error) {
	var out map[string]any
	req := map[string]string{"action": action, "reason": reason}
	err := c.do(ctx, http.MethodPost, "/v1/publications/"+url.PathEscape(id)+"/moderate", authRequired, req, &out)
	return out, err
}

func (c Client) Tombstone(ctx context.Context, id, reason string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodPost, "/v1/publications/"+url.PathEscape(id)+"/tombstone", authRequired, map[string]string{"reason": reason}, &out)
	return out, err
}

func (c Client) Revisions(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/publications/"+url.PathEscape(id)+"/revisions", authRequired, nil, &out)
	return out, err
}

func (c Client) ModerationHistory(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/publications/"+url.PathEscape(id)+"/moderation", authRequired, nil, &out)
	return out, err
}

func (c Client) List(ctx context.Context, cursor string, limit int) (map[string]any, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprint(limit))
	}
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/publications?"+q.Encode(), authNone, nil, &out)
	return out, err
}

func (c Client) ListEditorial(ctx context.Context, cursor string, limit int) (map[string]any, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprint(limit))
	}
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/editorial/publications?"+q.Encode(), authRequired, nil, &out)
	return out, err
}

func (c Client) ListNews(ctx context.Context, cursor string, limit int, source, topic, query string) (map[string]any, error) {
	q := url.Values{}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprint(limit))
	}
	if source != "" {
		q.Set("source", source)
	}
	if topic != "" {
		q.Set("topic", topic)
	}
	if query != "" {
		q.Set("q", query)
	}
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/news?"+q.Encode(), authNone, nil, &out)
	return out, err
}

func (c Client) GetNews(ctx context.Context, id string) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/news/"+url.PathEscape(id), authNone, nil, &out)
	return out, err
}

func (c Client) NewsSources(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/news/sources", authNone, nil, &out)
	return out, err
}

func (c Client) NewsTopics(ctx context.Context) (map[string]any, error) {
	var out map[string]any
	err := c.do(ctx, http.MethodGet, "/v1/news/topics", authNone, nil, &out)
	return out, err
}
