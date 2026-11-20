package discovery

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/indexer/tokenread"
	"github.com/420integrated/420-integrated/search/architecture"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type tokenReader interface {
	TokenDeployment(context.Context, string) (tokenread.Projection, error)
}

func (d *AssetValidatorDiscovery) ResolveToken(ctx context.Context, token string) ([]searchresult.Result, error) {
	token = strings.ToLower(token)
	if !tokenread.ValidAddress(token) {
		return nil, tokenread.ErrInvalid
	}
	reader, ok := d.reader.(tokenReader)
	if !ok {
		return nil, tokenread.ErrUnavailable
	}
	status, indexed, safe, err := d.qualifiedStatus(ctx)
	if err != nil {
		return nil, err
	}
	p, err := reader.TokenDeployment(ctx, token)
	if errors.Is(err, tokenread.ErrNotFound) {
		return []searchresult.Result{}, nil
	}
	if err != nil {
		return nil, err
	}
	chain, err := strconv.ParseUint(status.ChainID, 10, 64)
	if err != nil {
		return nil, err
	}
	if err = p.Validate(chain, token); err != nil {
		return nil, err
	}
	if p.SnapshotHeight != status.IndexedHead || !strings.EqualFold(p.SnapshotHash, status.IndexedHeadHash) {
		return nil, tokenread.ErrUnavailable
	}
	block, err := strconv.ParseUint(p.BlockNumber, 10, 64)
	if err != nil {
		return nil, err
	}
	evidence := provenance(p.ChainID, &block, p.BlockHash, p.TransactionHash, indexed, safe, d.now())
	evidence.Authority = "420Indexer historical factory creation and fee event projection; not endorsement or eligibility"
	evidence.LogIndex = p.LogIndex
	result, err := searchresult.New(architecture.DomainAsset, "420token:"+token, architecture.SearchModeResolver, evidence, searchresult.Presentation{
		Title: "420Token deployment " + token, Subtitle: p.Template + " V1", Snippet: "Observed creation and 42 native 420 fee events; not current ownership, listing, liquidity, or investment approval.", Category: "asset", CanonicalURL: "/transactions/" + p.TransactionHash, Tags: []string{"asset", "420Token", "deployment-provenance"}})
	if err != nil {
		return nil, err
	}
	return []searchresult.Result{result}, nil
}
