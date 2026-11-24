package indexerclient

import (
	"context"
	"errors"
	"net/url"
	"strconv"
)

const CompensationProtocol = "420DevelopmentCompensation"

type CompensationEvent struct {
	ChainID          string            `json:"chainId"`
	BlockNumber      string            `json:"blockNumber"`
	BlockHash        string            `json:"blockHash"`
	TransactionHash  string            `json:"transactionHash"`
	TransactionIndex uint64            `json:"transactionIndex"`
	LogIndex         uint64            `json:"logIndex"`
	ContractAddress  string            `json:"contractAddress"`
	Protocol         string            `json:"protocol"`
	EventName        string            `json:"eventName"`
	Fields           map[string]string `json:"fields"`
}

// WithCompensationIndexer binds the authenticated protocol projection endpoint.
func (c *Client) WithCompensationIndexer(baseURL string) error {
	upstream, err := NewWithHTTPClient(baseURL, c.http)
	if err != nil {
		return err
	}
	c.compensation = upstream
	return nil
}

func (c *Client) CompensationEvents(ctx context.Context, chainID uint64, hash string) ([]CompensationEvent, error) {
	if c.compensation == nil {
		return nil, errors.New("compensation Indexer is unconfigured")
	}
	filter := url.Values{
		"chainId":         {strconv.FormatUint(chainID, 10)},
		"protocol":        {CompensationProtocol},
		"transactionHash": {hash},
		"limit":           {"200"},
		"direction":       {"asc"},
	}
	var events []CompensationEvent
	for {
		var response struct {
			Version string `json:"apiVersion"`
			Data    *struct {
				Items      []CompensationEvent `json:"items"`
				NextCursor *string             `json:"nextCursor"`
			} `json:"data"`
		}
		if err := c.compensation.get(ctx, "/v1/protocols/events?"+filter.Encode(), &response); err != nil {
			return nil, err
		}
		if response.Version != "v1" || response.Data == nil || response.Data.Items == nil {
			return nil, errors.New("invalid compensation Indexer response")
		}
		events = append(events, response.Data.Items...)
		if response.Data.NextCursor == nil {
			return events, nil
		}
		if len(response.Data.Items) == 0 || *response.Data.NextCursor == "" || *response.Data.NextCursor == filter.Get("cursor") {
			return nil, errors.New("invalid compensation pagination")
		}
		filter.Set("cursor", *response.Data.NextCursor)
	}
}
