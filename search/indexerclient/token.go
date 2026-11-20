package indexerclient

import (
	"context"

	"github.com/420integrated/420-integrated/indexer/tokenread"
)

func (c *Client) TokenDeployment(ctx context.Context, token string) (tokenread.Projection, error) {
	return tokenread.ReadHTTP(ctx, c.http, c.baseURL, c.requiredChainID, token)
}
