package projection

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/media/authority"
	mediastorage "github.com/420integrated/420-integrated/media/storage"
	"github.com/420integrated/420-integrated/search/architecture"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

var (
	ErrInvalidProjection = errors.New("420media projection: invalid projection")
	ErrNotPublic         = errors.New("420media projection: asset is not publicly projectable")
	ErrUnqualifiedSource = errors.New("420media projection: unqualified indexer source")
)

type PublicAuthorizer interface {
	AuthorizePublication(context.Context, authority.Actor, authority.Binding) error
}

type IndexerStatus struct {
	Qualified       bool
	ChainID         uint64
	IndexedHeight   uint64
	SafeHeight      uint64
	FinalizedHeight uint64
}

type Provenance struct {
	BlockNumber     uint64
	BlockHash       string
	TransactionHash string
	LogIndex        uint64
	Finality        searchresult.Finality
	IndexedAt       time.Time
}

type Metadata struct {
	Title        string
	Subtitle     string
	Snippet      string
	CanonicalURL string
	Tags         []string
}

func BuildSearchResult(
	ctx context.Context,
	authorizer PublicAuthorizer,
	actor authority.Actor,
	binding authority.Binding,
	asset mediastorage.Asset,
	status IndexerStatus,
	provenance Provenance,
	metadata Metadata,
) (searchresult.Result, error) {
	if authorizer == nil {
		return searchresult.Result{}, ErrInvalidProjection
	}
	if err := mediastorage.AuthorizePublicProjection(ctx, authorizer, actor, asset, binding); err != nil {
		return searchresult.Result{}, err
	}
	if !mediastorage.CanProjectPublic(asset) {
		return searchresult.Result{}, ErrNotPublic
	}
	if !status.Qualified || status.ChainID == 0 || status.IndexedHeight == 0 {
		return searchresult.Result{}, ErrUnqualifiedSource
	}
	if provenance.BlockNumber == 0 || strings.TrimSpace(provenance.BlockHash) == "" ||
		strings.TrimSpace(provenance.TransactionHash) == "" || provenance.IndexedAt.IsZero() {
		return searchresult.Result{}, ErrInvalidProjection
	}
	if provenance.BlockNumber > status.IndexedHeight || status.SafeHeight > status.IndexedHeight ||
		status.FinalizedHeight > status.SafeHeight {
		return searchresult.Result{}, ErrInvalidProjection
	}
	if provenance.Finality != searchresult.FinalityHead &&
		provenance.Finality != searchresult.FinalitySafe &&
		provenance.Finality != searchresult.FinalityFinalized {
		return searchresult.Result{}, ErrInvalidProjection
	}
	switch provenance.Finality {
	case searchresult.FinalityFinalized:
		if provenance.BlockNumber > status.FinalizedHeight {
			return searchresult.Result{}, ErrInvalidProjection
		}
	case searchresult.FinalitySafe:
		if provenance.BlockNumber > status.SafeHeight {
			return searchresult.Result{}, ErrInvalidProjection
		}
	}

	title := strings.TrimSpace(metadata.Title)
	canonicalURL := strings.TrimSpace(metadata.CanonicalURL)
	if title == "" || canonicalURL == "" {
		return searchresult.Result{}, ErrInvalidProjection
	}
	if _, err := url.ParseRequestURI(canonicalURL); err != nil {
		return searchresult.Result{}, ErrInvalidProjection
	}
	blockNumber := provenance.BlockNumber
	logIndex := provenance.LogIndex
	indexedHeight := status.IndexedHeight
	finalizedHeight := status.FinalizedHeight
	result, err := searchresult.New(
		architecture.DomainAsset,
		"media:"+strings.ToLower(strings.TrimSpace(asset.ID)),
		architecture.SearchModeDiscovery,
		searchresult.Provenance{
			Source:          architecture.SourceIndexer,
			Authority:       "420Media public asset projection via qualified 420Indexer; canonical authority remains 420Media/420Storage/420Rights",
			ChainID:         status.ChainID,
			BlockNumber:     &blockNumber,
			BlockHash:       strings.ToLower(strings.TrimSpace(provenance.BlockHash)),
			TransactionHash: strings.ToLower(strings.TrimSpace(provenance.TransactionHash)),
			LogIndex:        &logIndex,
			Finality:        provenance.Finality,
			IndexedAt:       provenance.IndexedAt.UTC(),
			IndexedHeight:   &indexedHeight,
			FinalizedHeight: &finalizedHeight,
		},
		searchresult.Presentation{
			Title:        title,
			Subtitle:     strings.TrimSpace(metadata.Subtitle),
			Snippet:      strings.TrimSpace(metadata.Snippet),
			Category:     "media_asset",
			CanonicalURL: canonicalURL,
			Tags:         sanitizeTags(metadata.Tags),
		},
	)
	if err != nil {
		return searchresult.Result{}, err
	}
	if err := result.Validate(); err != nil {
		return searchresult.Result{}, err
	}
	return result, nil
}

func sanitizeTags(tags []string) []string {
	out := make([]string, 0, len(tags)+1)
	seen := map[string]struct{}{"media": {}}
	out = append(out, "media")
	for _, tag := range tags {
		tag = strings.ToLower(strings.TrimSpace(tag))
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		out = append(out, tag)
	}
	return out
}
