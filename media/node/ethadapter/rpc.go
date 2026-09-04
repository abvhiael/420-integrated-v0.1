package ethadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
)

type RPC interface {
	Call(ctx context.Context, method string, params any, result any) error
}

type HTTPRPC struct {
	url    string
	client *http.Client
	id     atomic.Uint64
}

func NewHTTPRPC(url string, client *http.Client) (*HTTPRPC, error) {
	if url == "" { return nil, errors.New("420media ethadapter: empty rpc url") }
	if client == nil { client = http.DefaultClient }
	return &HTTPRPC{url: url, client: client}, nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      uint64 `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      uint64          `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	} `json:"error"`
}

func (c *HTTPRPC) Call(ctx context.Context, method string, params any, result any) error {
	id := c.id.Add(1)
	payload, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	if err != nil { return err }
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(payload))
	if err != nil { return err }
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil { return err }
	if resp.StatusCode < 200 || resp.StatusCode > 299 { return fmt.Errorf("420media ethadapter: rpc http status %d", resp.StatusCode) }
	var decoded rpcResponse
	if err := json.Unmarshal(body, &decoded); err != nil { return err }
	if decoded.ID != id { return errors.New("420media ethadapter: rpc response id mismatch") }
	if decoded.Error != nil { return fmt.Errorf("420media ethadapter: rpc error %d: %s", decoded.Error.Code, decoded.Error.Message) }
	if result == nil { return nil }
	if len(decoded.Result) == 0 || bytes.Equal(decoded.Result, []byte("null")) { return errors.New("420media ethadapter: empty rpc result") }
	return json.Unmarshal(decoded.Result, result)
}
