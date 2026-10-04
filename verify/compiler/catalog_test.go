package compiler

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestCatalogRejectsBinaryPathEscape(t *testing.T) {
	_, err := NewCatalog(t.TempDir(), []Release{{
		Version: "0.8.24+commit.e11b9ed9",
		SHA256:  strings.Repeat("a", 64),
		Binary:  filepath.Join("..", "..", "bin", "solc"),
	}})
	if err == nil || !strings.Contains(err.Error(), "escapes the cache root") {
		t.Fatalf("expected cache-root escape rejection, got %v", err)
	}
}

func TestCatalogRejectsMalformedCompilerDigest(t *testing.T) {
	for _, digest := range []string{"deadbeef", strings.Repeat("z", 64)} {
		_, err := NewCatalog(t.TempDir(), []Release{{
			Version: "0.8.24+commit.e11b9ed9",
			SHA256:  digest,
			Binary:  "solc-0.8.24",
		}})
		if err == nil {
			t.Fatalf("expected digest %q to be rejected", digest)
		}
	}
}

func TestCatalogNormalizesDigestPrefixAndResolvesInsideRoot(t *testing.T) {
	root := t.TempDir()
	catalog, err := NewCatalog(root, []Release{{
		Version: "0.8.24+commit.e11b9ed9",
		SHA256:  "sha256:" + strings.Repeat("a", 64),
		Binary:  filepath.Join("solc", "0.8.24"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	release, resolved, err := catalog.Resolve("0.8.24+commit.e11b9ed9")
	if err != nil {
		t.Fatal(err)
	}
	if release.SHA256 != strings.Repeat("a", 64) {
		t.Fatalf("unexpected normalized digest %q", release.SHA256)
	}
	rel, err := filepath.Rel(root, resolved)
	if err != nil || strings.HasPrefix(rel, "..") {
		t.Fatalf("resolved compiler escaped root: %s", resolved)
	}
}
