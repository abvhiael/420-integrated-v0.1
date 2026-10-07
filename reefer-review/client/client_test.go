package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRR3ClientEditorialParity(t *testing.T) {
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.Method+" "+r.URL.Path)
		if r.URL.Path != "/readyz" && strings.HasPrefix(r.URL.Path, "/v1/") && r.URL.Path != "/v1/publications" && r.Header.Get("X-420-Actor") == "" {
			t.Fatalf("missing actor on %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	defer server.Close()

	c := Client{BaseURL: server.URL}
	ctx := context.Background()
	if _, err := c.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetPublication(ctx, "writer.420", "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.UpdatePublication(ctx, "writer.420", "pub_1", map[string]any{"title": "A"}); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Moderate(ctx, "moderator.420", "pub_1", "HIDE", "policy"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Tombstone(ctx, "writer.420", "pub_1", "withdraw"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Revisions(ctx, "writer.420", "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ModerationHistory(ctx, "moderator.420", "pub_1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ListEditorial(ctx, "writer.420", "", 20); err != nil {
		t.Fatal(err)
	}

	want := []string{
		"GET /readyz",
		"GET /v1/publications/pub_1",
		"PUT /v1/publications/pub_1",
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
