package engine

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

var (
	ErrUnauthorized = errors.New("engine api unauthorized")
	ErrRPC          = errors.New("engine api rpc error")
)

type Client struct {
	endpoint   string
	jwtSecret  []byte
	httpClient *http.Client
	nextID     atomic.Uint64
	clientID   string
	clientVer  string
}

func NewClient(endpoint string, jwtSecret []byte) (*Client, error) {
	if len(jwtSecret) != 32 {
		return nil, fmt.Errorf("jwt secret must be 32 bytes, got %d", len(jwtSecret))
	}
	return &Client{
		endpoint:   endpoint,
		jwtSecret:  append([]byte(nil), jwtSecret...),
		httpClient: &http.Client{Timeout: 10 * time.Second},
		clientID:   "fourtwentyd",
		clientVer:  "0.1.0-dev",
	}, nil
}

func LoadJWTSecret(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	s := strings.TrimSpace(string(raw))
	s = strings.TrimPrefix(s, "0x")
	decoded, err := hex.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("decode jwt secret: %w", err)
	}
	if len(decoded) != 32 {
		return nil, fmt.Errorf("jwt secret must decode to 32 bytes, got %d", len(decoded))
	}
	return decoded, nil
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
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (c *Client) jwtToken(now time.Time) (string, error) {
	header, _ := json.Marshal(map[string]any{"alg": "HS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{
		"iat": now.Unix(),
		"id":  c.clientID,
		"clv": c.clientVer,
	})
	enc := base64.RawURLEncoding
	unsigned := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)
	mac := hmac.New(sha256.New, c.jwtSecret)
	if _, err := mac.Write([]byte(unsigned)); err != nil {
		return "", err
	}
	sig := mac.Sum(nil)
	return unsigned + "." + enc.EncodeToString(sig), nil
}

func (c *Client) Call(ctx context.Context, method string, params any, out any) error {
	id := c.nextID.Add(1)
	reqBody, err := json.Marshal(rpcRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  method,
		Params:  params,
	})
	if err != nil {
		return err
	}

	token, err := c.jwtToken(time.Now().UTC())
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrUnauthorized
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("engine api http %d: %s", resp.StatusCode, string(raw))
	}

	var rr rpcResponse
	if err := json.Unmarshal(raw, &rr); err != nil {
		return fmt.Errorf("decode engine response: %w", err)
	}
	if rr.Error != nil {
		return fmt.Errorf("%w: code=%d message=%s", ErrRPC, rr.Error.Code, rr.Error.Message)
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(rr.Result, out); err != nil {
		return fmt.Errorf("decode engine result: %w", err)
	}
	return nil
}

func (c *Client) ExchangeCapabilities(ctx context.Context, caps []string) ([]string, error) {
	var out []string
	if err := c.Call(ctx, "engine_exchangeCapabilities", []any{caps}, &out); err != nil {
		return nil, err
	}
	return out, nil
}
