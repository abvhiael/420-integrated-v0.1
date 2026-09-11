package indexerclient

import (
	"context"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func (c *Client) Consensus(ctx context.Context) (model.ConsensusStatus, error) {
	var out indexerapi.ReadResponse[model.ConsensusStatus]
	if err := c.get(ctx, "/v1/consensus", &out); err != nil { return model.ConsensusStatus{}, err }
	if out.CanonicalAuthority { return model.ConsensusStatus{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}
