package indexerclient

import (
	"context"
	"net/url"
	"strconv"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
)

func (c *Client) StakeActivity(ctx context.Context, validatorID, address string, limit uint32) (indexerapi.StakeActivityPage, error) {
	q := url.Values{}
	if validatorID != "" { q.Set("validatorId", validatorID) }
	if address != "" { q.Set("address", address) }
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	path := "/v1/stake/activity"
	if encoded := q.Encode(); encoded != "" { path += "?" + encoded }
	var out indexerapi.StakeActivityPage
	if err := c.get(ctx, path, &out); err != nil { return indexerapi.StakeActivityPage{}, err }
	if out.CanonicalAuthority { return indexerapi.StakeActivityPage{}, ErrIndexerAuthorityViolation }
	return out, nil
}
