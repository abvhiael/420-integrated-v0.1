package indexerclient

import (
	"context"
	"net/url"
	"strconv"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
)

// AddressTransactions consumes only the shared qualified 420Indexer /v1 API.
func (c *Client) AddressTransactions(ctx context.Context, address string, limit uint32) (indexerapi.AddressTransactionPage, error) {
	q := url.Values{}
	q.Set("address", address)
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	var out indexerapi.AddressTransactionPage
	if err := c.get(ctx, "/v1/transactions?"+q.Encode(), &out); err != nil { return out, err }
	if out.CanonicalAuthority { return out, ErrIndexerAuthorityViolation }
	return out, nil
}
