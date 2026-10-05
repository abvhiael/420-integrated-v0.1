package registry

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
)

var (
	ErrIndexerAuthorityClaim = errors.New("420Indexer registry source claimed canonical authority")
	ErrIndexerRegistryMismatch = errors.New("420Indexer Registry projection address does not match configured ProtocolRegistry")
)

// IndexerSource is the production APPSTORE-2 Registry catalogue source.
//
// 420Indexer supplies a rebuildable projection of ProtocolRegistry events, but
// it never becomes canonical authority. AppStore binds the projection to the
// configured chain, the frozen ProtocolRegistry address and the indexer's
// finalized height before converting it into a Snapshot.
//
// ProtocolRegistry publishRegisteredService emits the version and registration
// profile in the same transaction/block. Filtering out versions activated above
// the finalized boundary therefore also excludes unfinalized profile data.
// Deprecations above the finalized boundary are ignored when reconstructing the
// finalized active state.
type IndexerSource struct {
	baseURL string
	chainID uint64
	registryAddress string
	http *http.Client
}

func NewIndexerSource(baseURL string, chainID uint64, registryAddress string, timeout time.Duration) (*IndexerSource, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, errors.New("invalid 420Indexer base URL")
	}
	registryAddress = strings.ToLower(strings.TrimSpace(registryAddress))
	if chainID == 0 || !validAddress(registryAddress) {
		return nil, ErrInvalidCanonicalRecord
	}
	if !strings.EqualFold(registryAddress, decoder.ProtocolRegistryCanonicalAddress420) {
		return nil, ErrIndexerRegistryMismatch
	}
	if timeout <= 0 { timeout = 10 * time.Second }
	return &IndexerSource{
		baseURL: baseURL,
		chainID: chainID,
		registryAddress: registryAddress,
		http: &http.Client{Timeout: timeout},
	}, nil
}

func newIndexerSourceWithHTTPClient(baseURL string, chainID uint64, registryAddress string, hc *http.Client) (*IndexerSource, error) {
	src, err := NewIndexerSource(baseURL, chainID, registryAddress, 10*time.Second)
	if err != nil { return nil, err }
	if hc == nil { return nil, errors.New("http client required") }
	src.http = hc
	return src, nil
}

func (s *IndexerSource) Snapshot(ctx context.Context) (Snapshot, error) {
	var health indexerapi.HealthResponse
	if err := s.get(ctx, "/v1/health", &health); err != nil {
		return Snapshot{}, fmt.Errorf("read 420Indexer health: %w", err)
	}
	if health.CanonicalAuthority {
		return Snapshot{}, ErrIndexerAuthorityClaim
	}
	if health.Health.ChainID != s.chainID || health.Health.FinalizedHeight == 0 {
		return Snapshot{}, ErrInvalidCanonicalRecord
	}

	var services indexerapi.ReadResponse[[]decoder.ServiceSummary]
	if err := s.get(ctx, "/v1/services", &services); err != nil {
		return Snapshot{}, fmt.Errorf("read 420Indexer Registry catalogue: %w", err)
	}
	if services.CanonicalAuthority {
		return Snapshot{}, ErrIndexerAuthorityClaim
	}

	versions := make([]VersionRecord, 0)
	for _, service := range services.Data {
		for _, version := range service.Versions {
			if version.ActivatedBlock == 0 || version.ActivatedBlock > health.Health.FinalizedHeight {
				continue
			}
			active := version.Active
			if version.DeprecatedBlock > health.Health.FinalizedHeight {
				active = true
			}
			versions = append(versions, VersionRecord{
				ServiceID: version.ServiceID,
				Version: version.Version,
				Implementation: version.Implementation,
				CodeHash: version.CodeHash,
				MetadataHash: version.MetadataHash,
				ComponentType: version.ComponentType,
				ManifestHash: version.ManifestHash,
				DependencyRoot: version.DependencyRoot,
				InterfaceHash: version.InterfaceHash,
				Active: active,
				BlockNumber: version.ActivatedBlock,
				BlockHash: version.ActivatedHash,
			})
		}
	}

	snapshot := Snapshot{
		ChainID: s.chainID,
		RegistryAddress: s.registryAddress,
		FinalizedBlock: health.Health.FinalizedHeight,
		Versions: versions,
	}
	// Validate the complete source result before returning it to callers.
	projection, err := NewProjection(s.chainID, s.registryAddress)
	if err != nil { return Snapshot{}, err }
	if err := projection.Rebuild(snapshot); err != nil {
		return Snapshot{}, fmt.Errorf("validate 420Indexer Registry snapshot: %w", err)
	}
	return snapshot, nil
}

func (s *IndexerSource) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+path, nil)
	if err != nil { return err }
	resp, err := s.http.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var body struct{ Error string `json:"error"` }
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body.Error == "" { body.Error = resp.Status }
		return fmt.Errorf("420Indexer read failed: %s", body.Error)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode 420Indexer response: %w", err)
	}
	return nil
}
