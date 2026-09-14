package indexerclient

import (
	"context"
	"net/url"
	"strconv"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
)

func (c *Client) AssetTransfers(ctx context.Context, assetKey, address string, limit uint32) (indexerapi.AssetTransferPage, error) {
	q := url.Values{}
	if assetKey != "" { q.Set("assetKey", assetKey) }
	if address != "" { q.Set("address", address) }
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	path := "/v1/asset-transfers"
	if encoded := q.Encode(); encoded != "" { path += "?" + encoded }
	var out indexerapi.AssetTransferPage
	if err := c.get(ctx, path, &out); err != nil { return out, err }
	if out.CanonicalAuthority { return out, ErrIndexerAuthorityViolation }
	return out, nil
}
