package indexerclient

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
)

type AssetTransfer struct {
	ChainID          string  `json:"chainId"`
	BlockNumber      string  `json:"blockNumber"`
	TransactionHash  string  `json:"transactionHash"`
	LogIndex         int     `json:"logIndex"`
	AssetKey         string  `json:"assetKey"`
	AssetKind        string  `json:"assetKind"`
	ContractAddress  *string `json:"contractAddress"`
	TokenID          *string `json:"tokenId"`
	From             string  `json:"from"`
	To               string  `json:"to"`
	Amount           string  `json:"amount"`
}

type AssetTransferPage struct {
	Items      []AssetTransfer `json:"items"`
	NextCursor *string         `json:"nextCursor"`
}

func (c *Client) AssetTransfers(ctx context.Context, assetKey string, limit uint32) (AssetTransferPage, error) {
	assetKey = strings.TrimSpace(assetKey)
	if assetKey == "" { return AssetTransferPage{}, errors.New("asset key required") }
	q := url.Values{}
	q.Set("chainId", strconv.FormatUint(c.requiredChainID, 10))
	q.Set("assetKey", assetKey)
	q.Set("direction", "desc")
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	var out AssetTransferPage
	if err := c.getData(ctx, "/v1/assets/transfers?"+q.Encode(), &out); err != nil { return AssetTransferPage{}, err }
	for _, transfer := range out.Items {
		if transfer.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return AssetTransferPage{}, ErrWrongChain }
		if transfer.AssetKey != assetKey { return AssetTransferPage{}, errors.New("420Indexer asset identity mismatch") }
	}
	return out, nil
}
