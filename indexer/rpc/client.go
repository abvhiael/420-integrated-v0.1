package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

var ErrRPC = errors.New("json-rpc error")

type Client struct {
	url    string
	http   *http.Client
	nextID atomic.Uint64
}

type request struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      uint64      `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      uint64          `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func NewClient(url string, timeout time.Duration) *Client {
	if timeout <= 0 { timeout = 15 * time.Second }
	return &Client{url: url, http: &http.Client{Timeout: timeout}}
}

func (c *Client) call(ctx context.Context, method string, params interface{}, out interface{}) error {
	id := c.nextID.Add(1)
	payload, err := json.Marshal(request{JSONRPC: "2.0", ID: id, Method: method, Params: params})
	if err != nil { return err }
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(payload))
	if err != nil { return err }
	req.Header.Set("content-type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("%w: http=%d body=%s", ErrRPC, resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var decoded response
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil { return err }
	if decoded.Error != nil { return fmt.Errorf("%w: code=%d message=%s", ErrRPC, decoded.Error.Code, decoded.Error.Message) }
	if out == nil { return nil }
	return json.Unmarshal(decoded.Result, out)
}

func parseHexUint64(v string) (uint64, error) {
	if v == "" { return 0, nil }
	return strconv.ParseUint(strings.TrimPrefix(v, "0x"), 16, 64)
}

func (c *Client) ChainID() (uint64, error) {
	var out string
	if err := c.call(context.Background(), "eth_chainId", []interface{}{}, &out); err != nil { return 0, err }
	return parseHexUint64(out)
}

func (c *Client) BlockNumber(ctx context.Context) (uint64, error) {
	var out string
	if err := c.call(ctx, "eth_blockNumber", []interface{}{}, &out); err != nil { return 0, err }
	return parseHexUint64(out)
}
