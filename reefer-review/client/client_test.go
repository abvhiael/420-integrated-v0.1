package client

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type tokenProvider string

func (p tokenProvider) Token(context.Context) (string, error) { return string(p), nil }

func TestRR4ClientBearerSessionParity(t *testing.T) {
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.Path)
		if r.Header.Get("X-420-Actor") != "" {
			t.Fatalf("legacy actor header sent on %s", r.URL.Path)
		}
		protected := r.Method != http.MethodGet ||
			strings.Contains(r.URL.Path, "/editorial/") ||
			strings.Contains(r.URL.Path, "/revisions") ||
			strings.Contains(r.URL.Path, "/moderation")
		if protected && r.URL.Path != "/readyz" && r.Header.Get("Authorization") != "Bearer wallet-session" {
			t.Fatalf("missing bearer on %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	c := Client{BaseURL: server.URL, Session: tokenProvider("wallet-session")}
	ctx := context.Background()
	if _, err := c.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetPublication(ctx, "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.UpdatePublication(ctx, "pub_1", map[string]any{"title": "A"}); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Publish(ctx, "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Moderate(ctx, "pub_1", "HIDE", "policy"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Tombstone(ctx, "pub_1", "withdraw"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Revisions(ctx, "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ModerationHistory(ctx, "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ListEditorial(ctx, "", 20); err != nil {
		t.Fatal(err)
	}

	want := []string{
		"GET /readyz",
		"GET /v1/publications/pub_1",
		"PUT /v1/publications/pub_1",
		"POST /v1/publications/pub_1/publish",
		"POST /v1/publications/pub_1/moderate",
		"POST /v1/publications/pub_1/tombstone",
		"GET /v1/publications/pub_1/revisions",
		"GET /v1/publications/pub_1/moderation",
		"GET /v1/editorial/publications",
	}
	if len(paths) != len(want) {
		t.Fatalf("paths mismatch: %v", paths)
	}
	for i := range want {
		if paths[i] != want[i] {
			t.Fatalf("path %d: got %q want %q", i, paths[i], want[i])
		}
	}
}

func TestRR4ClientProtectedMethodsFailWithoutSession(t *testing.T) {
	c := Client{BaseURL: "https://example.invalid"}
	_, err := c.CreateDraft(context.Background(), map[string]any{"title": "x"})
	if err == nil || !strings.Contains(err.Error(), "verified session required") {
		t.Fatalf("missing fail-closed session error: %v", err)
	}
}

func TestRR4ClientPropagatesSessionProviderError(t *testing.T) {
	want := errors.New("wallet unavailable")
	c := Client{BaseURL: "https://example.invalid", Session: SessionTokenProviderFunc(func(context.Context) (string, error) { return "", want })}
	_, err := c.Publish(context.Background(), "pub_1")
	if !errors.Is(err, want) {
		t.Fatalf("got %v want %v", err, want)
	}
}
