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
)

var (
	ErrWrongChain           = errors.New("420Indexer wrong chain")
	ErrIndexerNotReady      = errors.New("420Indexer not ready")
	ErrIndexerAuthoritative = errors.New("420Indexer claimed canonical authority")
	ErrIndexerStale         = errors.New("420Indexer data is stale")
)

type envelope[T any] struct {
	APIVersion string `json:"apiVersion"`
	Data       T      `json:"data"`
	Error      *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type Health struct {
	Status     string `json:"status"`
	APIVersion string `json:"apiVersion"`
}

type Readiness struct {
	Ready         bool   `json:"ready"`
	DatabaseReady bool   `json:"databaseReady"`
	ChainID       string `json:"chainId"`
	IndexedHead   string `json:"indexedHead"`
}

type Status struct {
	ChainID              string `json:"chainId"`
	IndexedHead          string `json:"indexedHead"`
	IndexedHeadHash      string `json:"indexedHeadHash"`
	IndexedHeadTimestamp string `json:"indexedHeadTimestamp"`
	Lag                  string `json:"lag"`
	Authoritative        bool   `json:"authoritative"`
	Finality             struct {
		Mode          string `json:"mode"`
		Confirmations string `json:"confirmations"`
		SafeHead      string `json:"safeHead"`
	} `json:"finality"`
}

type ProtocolObject struct {
	Protocol    string         `json:"protocol"`
	ObjectKey   string         `json:"objectKey"`
	Payload     map[string]any `json:"payload,omitempty"`
	BlockNumber string         `json:"blockNumber,omitempty"`
	TxHash      string         `json:"txHash,omitempty"`
}

type SnapshotProvenance struct {
	ChainID         uint64
	IndexedHeight   uint64
	IndexedHeadHash string
	SafeHeight      uint64
	IndexedAt       time.Time
}

type Client struct {
	baseURL         string
	http            *http.Client
	requiredChainID uint64
	staleAfter      time.Duration
	now             func() time.Time
}

func New(baseURL string, requiredChainID uint64, timeout, staleAfter time.Duration) (*Client, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, errors.New("420Indexer base URL required")
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, errors.New("invalid 420Indexer base URL")
	}
	if requiredChainID == 0 {
		return nil, errors.New("required chain ID must be non-zero")
	}
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	if staleAfter <= 0 {
		staleAfter = 2 * time.Minute
	}
	return &Client{
		baseURL:         baseURL,
		requiredChainID: requiredChainID,
		staleAfter:      staleAfter,
		http:            &http.Client{Timeout: timeout},
		now:             time.Now,
	}, nil
}

func NewWithHTTPClient(baseURL string, requiredChainID uint64, staleAfter time.Duration, hc *http.Client) (*Client, error) {
	c, err := New(baseURL, requiredChainID, 10*time.Second, staleAfter)
	if err != nil {
		return nil, err
	}
	if hc == nil {
		return nil, errors.New("http client required")
	}
	c.http = hc
	return c, nil
}

func (c *Client) Health(ctx context.Context) (Health, error) {
	var out Health
	if err := c.getRaw(ctx, "/health", &out); err != nil {
		return out, err
	}
	if out.Status != "ok" || out.APIVersion != "v1" {
		return out, errors.New("420Indexer health contract invalid")
	}
	return out, nil
}

func (c *Client) Readiness(ctx context.Context) (Readiness, error) {
	var out Readiness
	path := "/ready?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	if err := c.getData(ctx, path, &out); err != nil {
		return out, err
	}
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) {
		return out, ErrWrongChain
	}
	if !out.Ready || !out.DatabaseReady || out.IndexedHead == "" {
		return out, ErrIndexerNotReady
	}
	return out, nil
}

func (c *Client) Status(ctx context.Context) (Status, error) {
	var out Status
	path := "/v1/status?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	if err := c.getData(ctx, path, &out); err != nil {
		return out, err
	}
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) {
		return out, ErrWrongChain
	}
	if out.Authoritative {
		return out, ErrIndexerAuthoritative
	}
	if out.IndexedHead == "" || out.IndexedHeadTimestamp == "" {
		return out, ErrIndexerNotReady
	}
	unix, err := strconv.ParseInt(out.IndexedHeadTimestamp, 10, 64)
	if err != nil || unix < 0 {
		return out, errors.New("420Indexer status timestamp invalid")
	}
	age := c.now().Sub(time.Unix(unix, 0))
	if age < 0 {
		return out, errors.New("420Indexer status timestamp is in the future")
	}
	if age > c.staleAfter {
		return out, ErrIndexerStale
	}
	return out, nil
}

func (c *Client) Qualified(ctx context.Context) error {
	if _, err := c.Health(ctx); err != nil {
		return err
	}
	if _, err := c.Readiness(ctx); err != nil {
		return err
	}
	if _, err := c.Status(ctx); err != nil {
		return err
	}
	return nil
}

func (c *Client) Snapshot(ctx context.Context) (SnapshotProvenance, error) {
	status, err := c.Status(ctx)
	if err != nil {
		return SnapshotProvenance{}, err
	}
	indexed, err := strconv.ParseUint(status.IndexedHead, 10, 64)
	if err != nil || indexed == 0 {
		return SnapshotProvenance{}, errors.New("420Indexer indexed head invalid")
	}
	safe, err := strconv.ParseUint(status.Finality.SafeHead, 10, 64)
	if err != nil {
		return SnapshotProvenance{}, errors.New("420Indexer safe head invalid")
	}
	if safe > indexed {
		return SnapshotProvenance{}, errors.New("420Indexer safe head exceeds indexed head")
	}
	unix, _ := strconv.ParseInt(status.IndexedHeadTimestamp, 10, 64)
	return SnapshotProvenance{
		ChainID:         c.requiredChainID,
		IndexedHeight:   indexed,
		IndexedHeadHash: status.IndexedHeadHash,
		SafeHeight:      safe,
		IndexedAt:       time.Unix(unix, 0).UTC(),
	}, nil
}

func (c *Client) ProtocolObject(ctx context.Context, protocol, objectKey string) (ProtocolObject, error) {
	protocol = strings.TrimSpace(protocol)
	objectKey = strings.TrimSpace(objectKey)
	if protocol == "" || objectKey == "" {
		return ProtocolObject{}, errors.New("protocol and object key required")
	}
	path := "/v1/protocols/" + url.PathEscape(protocol) + "/objects/" + url.PathEscape(objectKey) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	var out ProtocolObject
	return out, c.getData(ctx, path, &out)
}

func (c *Client) getData(ctx context.Context, path string, out any) error {
	var env envelope[json.RawMessage]
	if err := c.getRaw(ctx, path, &env); err != nil {
		return err
	}
	if env.APIVersion != "v1" {
		return errors.New("unsupported 420Indexer API version")
	}
	if env.Error != nil {
		return fmt.Errorf("420Indexer %s: %s", env.Error.Code, env.Error.Message)
	}
	if len(env.Data) == 0 || string(env.Data) == "null" {
		return errors.New("420Indexer response missing data")
	}
	if err := json.Unmarshal(env.Data, out); err != nil {
		return fmt.Errorf("decode 420Indexer data: %w", err)
	}
	return nil
}

func (c *Client) getRaw(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var env envelope[json.RawMessage]
		_ = json.NewDecoder(resp.Body).Decode(&env)
		if env.Error != nil && env.Error.Message != "" {
			return fmt.Errorf("420Indexer %s: %s", env.Error.Code, env.Error.Message)
		}
		return fmt.Errorf("420Indexer HTTP %s", resp.Status)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode 420Indexer response: %w", err)
	}
	return nil
}
