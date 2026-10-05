package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func digestBytes(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func tlsDownloadFixture(t *testing.T, handler http.Handler) (*httptest.Server, *http.Client) {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	client := server.Client()
	client.Timeout = 5 * time.Second
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	t.Cleanup(server.Close)
	return server, client
}

func TestValidateWorkUnitSourceFailsClosed(t *testing.T) {
	payload := []byte("fixture")
	digest := digestBytes(payload)
	valid := WorkUnitSource{URL: "https://example.invalid/unit", SHA256: digest, SizeBytes: uint64(len(payload))}
	cases := []struct {
		name string
		edit func(*WorkUnitSource)
	}{
		{"http", func(s *WorkUnitSource) { s.URL = "http://example.invalid/unit" }},
		{"userinfo", func(s *WorkUnitSource) { s.URL = "https://user:secret@example.invalid/unit" }},
		{"fragment", func(s *WorkUnitSource) { s.URL = "https://example.invalid/unit#secret" }},
		{"uppercase-digest", func(s *WorkUnitSource) { s.SHA256 = strings.ToUpper(digest) }},
		{"short-digest", func(s *WorkUnitSource) { s.SHA256 = "abcd" }},
		{"zero-size", func(s *WorkUnitSource) { s.SizeBytes = 0 }},
		{"oversize", func(s *WorkUnitSource) { s.SizeBytes = 9; }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			source := valid
			tc.edit(&source)
			max := uint64(len(payload))
			if _, err := ValidateWorkUnitSource(source, max); err == nil {
				t.Fatal("unsafe source accepted")
			}
		})
	}
}

func TestWorkUnitDownloadVerifiesDigestAndAtomicallyStoresPrivateFile(t *testing.T) {
	payload := []byte("content-addressed-work-unit")
	digest := digestBytes(payload)
	var requests atomic.Int32
	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Header.Get("X-420-Artifact-SHA256") != digest {
			t.Error("digest request header missing")
		}
		if r.Header.Get("X-420-Artifact-Purpose") != "compute-work-unit" {
			t.Error("purpose request header missing")
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(payload)
	}))

	root := t.TempDir()
	downloader, err := NewWorkUnitDownloader(root, client, RequestAuthorizerFunc(func(_ context.Context, request *http.Request) error {
		request.Header.Set("Authorization", "Bearer test-secret")
		return nil
	}), 1<<20)
	if err != nil { t.Fatal(err) }

	artifact, err := downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL + "/unit?opaque=signed",
		SHA256: digest,
		SizeBytes: uint64(len(payload)),
		MediaType: "application/octet-stream",
		Purpose: "compute-work-unit",
	})
	if err != nil { t.Fatal(err) }
	if artifact.FromCache || artifact.SHA256 != digest || artifact.SizeBytes != uint64(len(payload)) {
		t.Fatalf("unexpected artifact: %+v", artifact)
	}
	info, err := os.Stat(artifact.Path)
	if err != nil { t.Fatal(err) }
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("artifact mode=%o", info.Mode().Perm())
	}
	data, err := os.ReadFile(artifact.Path)
	if err != nil { t.Fatal(err) }
	if string(data) != string(payload) {
		t.Fatal("stored payload mismatch")
	}

	cached, err := downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL + "/unit?different=ignored-because-cache",
		SHA256: digest,
		SizeBytes: uint64(len(payload)),
	})
	if err != nil { t.Fatal(err) }
	if !cached.FromCache || requests.Load() != 1 {
		t.Fatalf("cache did not avoid second download: cached=%v requests=%d", cached.FromCache, requests.Load())
	}
}

func TestWorkUnitDownloadRejectsDigestMismatchAndLeavesNoArtifact(t *testing.T) {
	payload := []byte("actual")
	expected := digestBytes([]byte("expected"))
	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(payload)
	}))
	root := t.TempDir()
	downloader, err := NewWorkUnitDownloader(root, client, nil, 1<<20)
	if err != nil { t.Fatal(err) }
	_, err = downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL + "/unit",
		SHA256: expected,
		SizeBytes: uint64(len(payload)),
	})
	if !errors.Is(err, ErrDigestMismatch) {
		t.Fatalf("expected digest mismatch, got %v", err)
	}
	final := filepath.Join(root, "work-units", "sha256", expected+".bin")
	if _, statErr := os.Stat(final); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("mismatched artifact was published: %v", statErr)
	}
}

func TestWorkUnitDownloadRejectsOversizeAndTruncatedBodies(t *testing.T) {
	for _, tc := range []struct{
		name string
		body string
		expectedSize uint64
	}{
		{"oversize", "123456", 5},
		{"truncated", "1234", 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Length", "-1")
				_, _ = w.Write([]byte(tc.body))
			}))
			downloader, err := NewWorkUnitDownloader(t.TempDir(), client, nil, 10)
			if err != nil { t.Fatal(err) }
			_, err = downloader.Fetch(context.Background(), WorkUnitSource{
				URL: server.URL,
				SHA256: digestBytes([]byte(tc.body[:min(len(tc.body), int(tc.expectedSize))])),
				SizeBytes: tc.expectedSize,
			})
			if !errors.Is(err, ErrSizeMismatch) {
				t.Fatalf("expected size mismatch, got %v", err)
			}
		})
	}
}

func TestWorkUnitDownloadRejectsRedirectsAndMediaTypeMismatch(t *testing.T) {
	target, targetClient := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("target"))
	}))
	_ = targetClient
	redirect, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Redirect(w, &http.Request{}, target.URL, http.StatusFound)
	}))
	downloader, err := NewWorkUnitDownloader(t.TempDir(), client, nil, 1<<20)
	if err != nil { t.Fatal(err) }
	_, err = downloader.Fetch(context.Background(), WorkUnitSource{
		URL: redirect.URL,
		SHA256: digestBytes([]byte("target")),
		SizeBytes: 6,
	})
	if err == nil {
		t.Fatal("redirect unexpectedly accepted")
	}

	payload := []byte("typed")
	typed, typedClient := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write(payload)
	}))
	downloader, err = NewWorkUnitDownloader(t.TempDir(), typedClient, nil, 1<<20)
	if err != nil { t.Fatal(err) }
	_, err = downloader.Fetch(context.Background(), WorkUnitSource{
		URL: typed.URL,
		SHA256: digestBytes(payload),
		SizeBytes: uint64(len(payload)),
		MediaType: "application/octet-stream",
	})
	if err == nil {
		t.Fatal("media-type mismatch unexpectedly accepted")
	}
}

func TestWorkUnitDownloadRejectsCorruptCacheAndRefetches(t *testing.T) {
	payload := []byte("fresh-content")
	digest := digestBytes(payload)
	var requests atomic.Int32
	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		_, _ = w.Write(payload)
	}))
	root := t.TempDir()
	downloader, err := NewWorkUnitDownloader(root, client, nil, 1<<20)
	if err != nil { t.Fatal(err) }

	final := filepath.Join(root, "work-units", "sha256", digest+".bin")
	if err := os.WriteFile(final, []byte("corrupt-cache"), 0o600); err != nil {
		t.Fatal(err)
	}
	artifact, err := downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL,
		SHA256: digest,
		SizeBytes: uint64(len(payload)),
	})
	if err != nil { t.Fatal(err) }
	if artifact.FromCache || requests.Load() != 1 {
		t.Fatalf("corrupt cache was trusted: %+v requests=%d", artifact, requests.Load())
	}
}

func TestWorkUnitDownloadRejectsSymlinkCache(t *testing.T) {
	payload := []byte("safe-content")
	digest := digestBytes(payload)
	root := t.TempDir()
	downloader, err := NewWorkUnitDownloader(root, &http.Client{Timeout: time.Second}, nil, 1<<20)
	if err != nil { t.Fatal(err) }

	outside := filepath.Join(root, "outside")
	if err := os.WriteFile(outside, payload, 0o600); err != nil { t.Fatal(err) }
	final := filepath.Join(root, "work-units", "sha256", digest+".bin")
	if err := os.Symlink(outside, final); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if _, ok := downloader.verifyCached(final, WorkUnitSource{SHA256: digest, SizeBytes: uint64(len(payload))}); ok {
		t.Fatal("symlink cache entry trusted")
	}
}

func TestWorkUnitDownloadAuthorizationFailureMakesNoRequest(t *testing.T) {
	payload := []byte("payload")
	var requests atomic.Int32
	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		_, _ = w.Write(payload)
	}))
	downloader, err := NewWorkUnitDownloader(t.TempDir(), client, RequestAuthorizerFunc(func(context.Context, *http.Request) error {
		return errors.New("denied")
	}), 1<<20)
	if err != nil { t.Fatal(err) }
	_, err = downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL,
		SHA256: digestBytes(payload),
		SizeBytes: uint64(len(payload)),
	})
	if err == nil || requests.Load() != 0 {
		t.Fatalf("authorization failure did not fail closed: err=%v requests=%d", err, requests.Load())
	}
}
