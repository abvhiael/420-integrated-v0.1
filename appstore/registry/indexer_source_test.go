package registry

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

func validIndexerVersion(version uint32, activated uint64) decoder.ServiceVersion {
	return decoder.ServiceVersion{
		ServiceID:      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Version:        version,
		Implementation: impl1,
		CodeHash:       h1,
		MetadataHash:   h2,
		ComponentType:  2,
		ManifestHash:   h3,
		DependencyRoot: h4,
		InterfaceHash:  h1,
		ActivatedBlock: activated,
		ActivatedHash:  h3,
		Active:         true,
	}
}

func indexerServer(t *testing.T, health indexerapi.HealthResponse, services indexerapi.ReadResponse[[]decoder.ServiceSummary]) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("content-type", "application/json")
		switch r.URL.Path {
		case "/v1/health":
			_ = json.NewEncoder(w).Encode(health)
		case "/v1/services":
			_ = json.NewEncoder(w).Encode(services)
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestIndexerSourceBuildsFinalizedSnapshot(t *testing.T) {
	finalized := uint64(20)
	v1 := validIndexerVersion(1, 10)
	v2 := validIndexerVersion(2, 21)
	server := indexerServer(t,
		indexerapi.HealthResponse{Health: model.Health{ChainID: 420, FinalizedHeight: finalized}},
		indexerapi.ReadResponse[[]decoder.ServiceSummary]{Data: []decoder.ServiceSummary{{ServiceID: v1.ServiceID, Versions: []decoder.ServiceVersion{v1, v2}}}},
	)
	defer server.Close()

	src, err := NewIndexerSource(server.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := src.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.FinalizedBlock != finalized || len(snapshot.Versions) != 1 || snapshot.Versions[0].Version != 1 {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
}

func TestIndexerSourceIgnoresUnfinalizedDeprecation(t *testing.T) {
	v := validIndexerVersion(1, 10)
	v.Active = false
	v.DeprecatedBlock = 25
	server := indexerServer(t,
		indexerapi.HealthResponse{Health: model.Health{ChainID: 420, FinalizedHeight: 20}},
		indexerapi.ReadResponse[[]decoder.ServiceSummary]{Data: []decoder.ServiceSummary{{ServiceID: v.ServiceID, Versions: []decoder.ServiceVersion{v}}}},
	)
	defer server.Close()
	src, _ := NewIndexerSource(server.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	snapshot, err := src.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Versions) != 1 || !snapshot.Versions[0].Active {
		t.Fatalf("unfinalized deprecation leaked into finalized snapshot: %#v", snapshot.Versions)
	}
}

func TestIndexerSourceRejectsAuthorityClaimWrongChainAndRegistry(t *testing.T) {
	server := indexerServer(t,
		indexerapi.HealthResponse{Health: model.Health{ChainID: 420, FinalizedHeight: 20}, CanonicalAuthority: true},
		indexerapi.ReadResponse[[]decoder.ServiceSummary]{},
	)
	defer server.Close()
	src, _ := NewIndexerSource(server.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	if _, err := src.Snapshot(context.Background()); !errors.Is(err, ErrIndexerAuthorityClaim) {
		t.Fatalf("authority claim err=%v", err)
	}

	server2 := indexerServer(t,
		indexerapi.HealthResponse{Health: model.Health{ChainID: 421, FinalizedHeight: 20}},
		indexerapi.ReadResponse[[]decoder.ServiceSummary]{},
	)
	defer server2.Close()
	src2, _ := NewIndexerSource(server2.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	if _, err := src2.Snapshot(context.Background()); !errors.Is(err, ErrInvalidCanonicalRecord) {
		t.Fatalf("wrong chain err=%v", err)
	}

	if _, err := NewIndexerSource(server.URL, 420, impl1, time.Second); !errors.Is(err, ErrIndexerRegistryMismatch) {
		t.Fatalf("registry mismatch err=%v", err)
	}
}

func TestIndexerSourceRejectsMalformedCanonicalRecordAndHTTPFailure(t *testing.T) {
	bad := validIndexerVersion(1, 10)
	bad.CodeHash = "0x1234"
	server := indexerServer(t,
		indexerapi.HealthResponse{Health: model.Health{ChainID: 420, FinalizedHeight: 20}},
		indexerapi.ReadResponse[[]decoder.ServiceSummary]{Data: []decoder.ServiceSummary{{ServiceID: bad.ServiceID, Versions: []decoder.ServiceVersion{bad}}}},
	)
	defer server.Close()
	src, _ := NewIndexerSource(server.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	if _, err := src.Snapshot(context.Background()); err == nil {
		t.Fatal("expected malformed canonical record rejection")
	}

	fail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusServiceUnavailable)
	}))
	defer fail.Close()
	srcFail, _ := NewIndexerSource(fail.URL, 420, decoder.ProtocolRegistryCanonicalAddress420, time.Second)
	if _, err := srcFail.Snapshot(context.Background()); err == nil {
		t.Fatal("expected source failure")
	}
}
