package indexerclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrIndexerAuthorityViolation = errors.New("420Indexer response claimed canonical authority")

// Client is 420Explorer's only chain-index data dependency. 420Explorer does
// not connect to node420 JSON-RPC or maintain an independent ingestion loop.
type Client struct {
	baseURL string
	http    *http.Client
}

func New(baseURL string, timeout time.Duration) (*Client, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" { return nil, errors.New("420Indexer base URL required") }
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" { return nil, errors.New("invalid 420Indexer base URL") }
	if timeout <= 0 { timeout = 10 * time.Second }
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: timeout}}, nil
}

func NewWithHTTPClient(baseURL string, hc *http.Client) (*Client, error) {
	c, err := New(baseURL, 10*time.Second)
	if err != nil { return nil, err }
	if hc == nil { return nil, errors.New("http client required") }
	c.http = hc
	return c, nil
}

func (c *Client) Health(ctx context.Context) (indexerapi.HealthResponse, error) {
	var out indexerapi.HealthResponse
	if err := c.get(ctx, "/v1/health", &out); err != nil { return out, err }
	if out.CanonicalAuthority { return out, ErrIndexerAuthorityViolation }
	return out, nil
}

func (c *Client) Block(ctx context.Context, number uint64) (model.BlockRecord, error) {
	var out model.BlockRecord
	return out, c.get(ctx, "/v1/blocks/"+strconv.FormatUint(number, 10), &out)
}

func (c *Client) Blocks(ctx context.Context, limit uint32, cursor string) (indexerapi.BlockPage, error) {
	q := url.Values{}
	if limit != 0 { q.Set("limit", strconv.FormatUint(uint64(limit), 10)) }
	if cursor != "" { q.Set("cursor", cursor) }
	path := "/v1/blocks"
	if encoded := q.Encode(); encoded != "" { path += "?" + encoded }
	var out indexerapi.BlockPage
	return out, c.get(ctx, path, &out)
}

func (c *Client) Transaction(ctx context.Context, hash string) (model.TransactionRecord, error) {
	var out indexerapi.ReadResponse[model.TransactionRecord]
	if err := c.get(ctx, "/v1/transactions/"+url.PathEscape(hash), &out); err != nil { return model.TransactionRecord{}, err }
	if out.CanonicalAuthority { return model.TransactionRecord{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}

func (c *Client) Receipt(ctx context.Context, hash string) (model.ReceiptRecord, error) {
	var out indexerapi.ReadResponse[model.ReceiptRecord]
	if err := c.get(ctx, "/v1/receipts/"+url.PathEscape(hash), &out); err != nil { return model.ReceiptRecord{}, err }
	if out.CanonicalAuthority { return model.ReceiptRecord{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}

func (c *Client) BlockLogs(ctx context.Context, number uint64) ([]model.LogRecord, error) {
	var out indexerapi.ReadResponse[[]model.LogRecord]
	if err := c.get(ctx, "/v1/blocks/"+strconv.FormatUint(number, 10)+"/logs", &out); err != nil { return nil, err }
	if out.CanonicalAuthority { return nil, ErrIndexerAuthorityViolation }
	return out.Data, nil
}

func (c *Client) ServiceVersion(ctx context.Context, serviceID string, version uint32) (decoder.ServiceVersion, error) {
	var out indexerapi.ReadResponse[decoder.ServiceVersion]
	path := "/v1/services/" + url.PathEscape(serviceID) + "/versions/" + strconv.FormatUint(uint64(version), 10)
	if err := c.get(ctx, path, &out); err != nil { return decoder.ServiceVersion{}, err }
	if out.CanonicalAuthority { return decoder.ServiceVersion{}, ErrIndexerAuthorityViolation }
	return out.Data, nil
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil { return err }
	resp, err := c.http.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var body struct{ Error string `json:"error"` }
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if body.Error == "" { body.Error = resp.Status }
		return fmt.Errorf("420Indexer read failed: %s", body.Error)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil { return fmt.Errorf("decode 420Indexer response: %w", err) }
	return nil
}
