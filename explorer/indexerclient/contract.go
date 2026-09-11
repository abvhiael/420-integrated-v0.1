package indexerclient

import (
	"context"
	"net/url"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func (c *Client) Contract(ctx context.Context, address string) (model.ContractRecord, error) {
	var out indexerapi.ReadResponse[model.ContractRecord]
	if err := c.get(ctx, "/v1/contracts/"+url.PathEscape(address), &out); err != nil { return model.ContractRecord{}, err }
	if out.CanonicalAuthority { return model.ContractRecord{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}
