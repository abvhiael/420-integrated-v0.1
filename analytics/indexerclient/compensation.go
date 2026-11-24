package indexerclient

import (
	"context"
	"encoding/json"
	"net/url"
	"strconv"
)

func (c *Client) CompensationReport(ctx context.Context, from, to uint64) (json.RawMessage, error) {
	query := url.Values{
		"chainId": {strconv.FormatUint(c.requiredChainID, 10)},
		"from":    {strconv.FormatUint(from, 10)},
		"to":      {strconv.FormatUint(to, 10)},
	}
	var report json.RawMessage
	err := c.getData(ctx, "/v1/protocols/development-compensation/report?"+query.Encode(), &report)
	return report, err
}
