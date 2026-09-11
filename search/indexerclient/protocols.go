package indexerclient

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
)

// ProtocolEvent is the public, decoded 420Indexer protocol-event DTO. Fields are
// event arguments only; Search must never treat them as permission to retrieve
// referenced private/encrypted payloads.
type ProtocolEvent struct {
	ChainID          string         `json:"chainId"`
	BlockNumber      string         `json:"blockNumber"`
	BlockHash        string         `json:"blockHash"`
	TransactionHash  string         `json:"transactionHash"`
	TransactionIndex int            `json:"transactionIndex"`
	LogIndex         int            `json:"logIndex"`
	ContractAddress  string         `json:"contractAddress"`
	Protocol         string         `json:"protocol"`
	EventName        string         `json:"eventName"`
	ObjectKey        *string        `json:"objectKey"`
	LifecycleState   *string        `json:"lifecycleState"`
	Fields           map[string]any `json:"fields"`
}

type ProtocolEventPage struct {
	Items      []ProtocolEvent `json:"items"`
	NextCursor *string         `json:"nextCursor"`
}

// ProtocolState is the latest public protocol-object projection exposed by
// 420Indexer. It is rebuildable projection data, not canonical Search state.
type ProtocolState struct {
	ChainID          string         `json:"chainId"`
	Protocol         string         `json:"protocol"`
	ObjectKey        string         `json:"objectKey"`
	ContractAddress  string         `json:"contractAddress"`
	EventName        string         `json:"eventName"`
	LifecycleState   *string        `json:"lifecycleState"`
	Fields           map[string]any `json:"fields"`
	BlockNumber      string         `json:"blockNumber"`
	BlockHash        string         `json:"blockHash"`
	TransactionHash  string         `json:"transactionHash"`
	TransactionIndex int            `json:"transactionIndex"`
	LogIndex         int            `json:"logIndex"`
}

func (c *Client) ProtocolState(ctx context.Context, protocol, objectKey string) (ProtocolState, error) {
	protocol = strings.TrimSpace(protocol)
	objectKey = strings.TrimSpace(objectKey)
	if protocol == "" || objectKey == "" { return ProtocolState{}, errors.New("protocol and object key required") }
	path := "/v1/protocols/" + url.PathEscape(protocol) + "/objects/" + url.PathEscape(objectKey) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	var out ProtocolState
	if err := c.getData(ctx, path, &out); err != nil { return ProtocolState{}, err }
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return ProtocolState{}, ErrWrongChain }
	if out.Protocol != protocol || out.ObjectKey != objectKey { return ProtocolState{}, errors.New("420Indexer protocol object identity mismatch") }
	return out, nil
}

func (c *Client) ProtocolEvents(ctx context.Context, protocol, objectKey string, limit uint32) (ProtocolEventPage, error) {
	protocol = strings.TrimSpace(protocol)
	objectKey = strings.TrimSpace(objectKey)
	if protocol == "" { return ProtocolEventPage{}, errors.New("protocol required") }
	q := url.Values{}
	q.Set("chainId", strconv.FormatUint(c.requiredChainID, 10))
	q.Set("protocol", protocol)
	if objectKey != "" { q.Set("objectKey", objectKey) }
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	q.Set("direction", "asc")
	var out ProtocolEventPage
	if err := c.getData(ctx, "/v1/protocols/events?"+q.Encode(), &out); err != nil { return ProtocolEventPage{}, err }
	for _, event := range out.Items {
		if event.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return ProtocolEventPage{}, ErrWrongChain }
		if event.Protocol != protocol { return ProtocolEventPage{}, errors.New("420Indexer protocol event identity mismatch") }
		if objectKey != "" && (event.ObjectKey == nil || *event.ObjectKey != objectKey) { return ProtocolEventPage{}, errors.New("420Indexer protocol event object mismatch") }
	}
	return out, nil
}
