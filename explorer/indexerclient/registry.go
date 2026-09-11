package indexerclient

import (
	"context"
	"net/url"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
)

func (c *Client) Services(ctx context.Context) ([]decoder.ServiceSummary, error) {
	var out indexerapi.ReadResponse[[]decoder.ServiceSummary]
	if err := c.get(ctx, "/v1/services", &out); err != nil { return nil, err }
	if out.CanonicalAuthority { return nil, ErrIndexerAuthorityViolation }
	return out.Data, nil
}

func (c *Client) Service(ctx context.Context, serviceID string) (decoder.ServiceSummary, error) {
	var out indexerapi.ReadResponse[decoder.ServiceSummary]
	if err := c.get(ctx, "/v1/services/"+url.PathEscape(serviceID), &out); err != nil { return decoder.ServiceSummary{}, err }
	if out.CanonicalAuthority { return decoder.ServiceSummary{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}
