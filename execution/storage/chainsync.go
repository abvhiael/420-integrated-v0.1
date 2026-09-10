package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

var (
	ErrRPC                 = errors.New("chain rpc error")
	ErrInvalidChainState   = errors.New("invalid chain state")
	ErrChainReorganization = errors.New("chain reorganization detected")
)

type BlockRef struct {
	Number uint64 `json:"number"`
	Hash   string `json:"hash"`
}

type ChainLog struct {
	Address     string   `json:"address"`
	Topics      []string `json:"topics"`
	Data        string   `json:"data"`
	BlockNumber uint64   `json:"block_number"`
	BlockHash   string   `json:"block_hash"`
	TxHash      string   `json:"tx_hash"`
	LogIndex    uint64   `json:"log_index"`
	Removed     bool     `json:"removed"`
}

type LogFilter struct {
	Addresses []string
	Topics    [][]string
}

type ChainBackend interface {
	LatestBlock(ctx context.Context) (BlockRef, error)
	BlockByNumber(ctx context.Context, number uint64) (BlockRef, error)
	Logs(ctx context.Context, fromBlock, toBlock uint64, filter LogFilter) ([]ChainLog, error)
}

type ChainProjection interface {
	Filter() LogFilter
	Apply(ctx context.Context, log ChainLog) error
	Reset(ctx context.Context, fromBlock uint64) error
}

type SyncCursor struct {
	BlockNumber uint64 `json:"block_number"`
	BlockHash   string `json:"block_hash"`
}

type CursorStore interface {
	Load(ctx context.Context) (SyncCursor, error)
	Save(ctx context.Context, cursor SyncCursor) error
	Clear(ctx context.Context) error
}

type FileCursorStore struct {
	mu   sync.Mutex
	path string
}

func NewFileCursorStore(path string) (*FileCursorStore, error) {
	if strings.TrimSpace(path) == "" {
		return nil, ErrInvalidChainState
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	return &FileCursorStore{path: path}, nil
}

func (s *FileCursorStore) Load(_ context.Context) (SyncCursor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return SyncCursor{}, nil
	}
	if err != nil {
		return SyncCursor{}, err
	}
	var cursor SyncCursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return SyncCursor{}, err
	}
	return cursor, nil
}

func (s *FileCursorStore) Save(_ context.Context, cursor SyncCursor) error {
	if cursor.BlockNumber != 0 && cursor.BlockHash == "" {
		return ErrInvalidChainState
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.Marshal(cursor)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *FileCursorStore) Clear(_ context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.Remove(s.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

type Syncer struct {
	Backend       ChainBackend
	Cursor        CursorStore
	Projection    ChainProjection
	StartBlock    uint64
	Confirmations uint64
	BatchSize     uint64
}

func (s Syncer) Sync(ctx context.Context) (SyncCursor, error) {
	if s.Backend == nil || s.Cursor == nil || s.Projection == nil {
		return SyncCursor{}, ErrInvalidChainState
	}
	batch := s.BatchSize
	if batch == 0 {
		batch = 256
	}
	latest, err := s.Backend.LatestBlock(ctx)
	if err != nil {
		return SyncCursor{}, err
	}
	if latest.Number < s.Confirmations {
		return SyncCursor{}, nil
	}
	target := latest.Number - s.Confirmations
	cursor, err := s.Cursor.Load(ctx)
	if err != nil {
		return SyncCursor{}, err
	}

	if cursor.BlockNumber != 0 {
		canonical, err := s.Backend.BlockByNumber(ctx, cursor.BlockNumber)
		if err != nil {
			return SyncCursor{}, err
		}
		if !equalHex(canonical.Hash, cursor.BlockHash) {
			if err := s.Projection.Reset(ctx, s.StartBlock); err != nil {
				return SyncCursor{}, err
			}
			if err := s.Cursor.Clear(ctx); err != nil {
				return SyncCursor{}, err
			}
			return SyncCursor{}, ErrChainReorganization
		}
	}

	from := s.StartBlock
	if cursor.BlockNumber != 0 {
		if cursor.BlockNumber == ^uint64(0) {
			return SyncCursor{}, ErrInvalidChainState
		}
		from = cursor.BlockNumber + 1
	}
	if from > target {
		return cursor, nil
	}

	for from <= target {
		to := from + batch - 1
		if to < from || to > target {
			to = target
		}
		logs, err := s.Backend.Logs(ctx, from, to, s.Projection.Filter())
		if err != nil {
			return cursor, err
		}
		for _, log := range logs {
			if log.Removed || log.BlockNumber < from || log.BlockNumber > to || log.BlockHash == "" {
				return cursor, ErrInvalidChainState
			}
			if err := s.Projection.Apply(ctx, log); err != nil {
				return cursor, err
			}
		}
		block, err := s.Backend.BlockByNumber(ctx, to)
		if err != nil {
			return cursor, err
		}
		if block.Number != to || block.Hash == "" {
			return cursor, ErrInvalidChainState
		}
		cursor = SyncCursor{BlockNumber: to, BlockHash: block.Hash}
		if err := s.Cursor.Save(ctx, cursor); err != nil {
			return SyncCursor{}, err
		}
		if to == target {
			break
		}
		from = to + 1
	}
	return cursor, nil
}

type RPCBackend struct {
	URL    string
	Client *http.Client
}

type rpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      uint64      `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      uint64          `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (r RPCBackend) call(ctx context.Context, method string, params interface{}, out interface{}) error {
	if strings.TrimSpace(r.URL) == "" {
		return ErrRPC
	}
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: 1, Method: method, Params: params})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, r.URL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	client := r.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("%w: http %d", ErrRPC, resp.StatusCode)
	}
	var decoded rpcResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&decoded); err != nil {
		return err
	}
	if decoded.Error != nil {
		return fmt.Errorf("%w: %d %s", ErrRPC, decoded.Error.Code, decoded.Error.Message)
	}
	if len(decoded.Result) == 0 || string(decoded.Result) == "null" {
		return ErrRPC
	}
	return json.Unmarshal(decoded.Result, out)
}

func (r RPCBackend) LatestBlock(ctx context.Context) (BlockRef, error) {
	var raw string
	if err := r.call(ctx, "eth_blockNumber", []interface{}{}, &raw); err != nil {
		return BlockRef{}, err
	}
	n, err := parseHexUint64(raw)
	if err != nil {
		return BlockRef{}, err
	}
	return r.BlockByNumber(ctx, n)
}

func (r RPCBackend) BlockByNumber(ctx context.Context, number uint64) (BlockRef, error) {
	var raw struct {
		Number string `json:"number"`
		Hash   string `json:"hash"`
	}
	if err := r.call(ctx, "eth_getBlockByNumber", []interface{}{hexUint64(number), false}, &raw); err != nil {
		return BlockRef{}, err
	}
	n, err := parseHexUint64(raw.Number)
	if err != nil || raw.Hash == "" {
		return BlockRef{}, ErrInvalidChainState
	}
	return BlockRef{Number: n, Hash: raw.Hash}, nil
}

func (r RPCBackend) Logs(ctx context.Context, fromBlock, toBlock uint64, filter LogFilter) ([]ChainLog, error) {
	query := map[string]interface{}{
		"fromBlock": hexUint64(fromBlock),
		"toBlock":   hexUint64(toBlock),
	}
	if len(filter.Addresses) == 1 {
		query["address"] = filter.Addresses[0]
	} else if len(filter.Addresses) > 1 {
		query["address"] = filter.Addresses
	}
	if len(filter.Topics) > 0 {
		topics := make([]interface{}, len(filter.Topics))
		for i, choices := range filter.Topics {
			switch len(choices) {
			case 0:
				topics[i] = nil
			case 1:
				topics[i] = choices[0]
			default:
				topics[i] = choices
			}
		}
		query["topics"] = topics
	}
	var raw []struct {
		Address     string   `json:"address"`
		Topics      []string `json:"topics"`
		Data        string   `json:"data"`
		BlockNumber string   `json:"blockNumber"`
		BlockHash   string   `json:"blockHash"`
		TxHash      string   `json:"transactionHash"`
		LogIndex    string   `json:"logIndex"`
		Removed     bool     `json:"removed"`
	}
	if err := r.call(ctx, "eth_getLogs", []interface{}{query}, &raw); err != nil {
		return nil, err
	}
	logs := make([]ChainLog, 0, len(raw))
	for _, item := range raw {
		bn, err := parseHexUint64(item.BlockNumber)
		if err != nil {
			return nil, err
		}
		li, err := parseHexUint64(item.LogIndex)
		if err != nil {
			return nil, err
		}
		logs = append(logs, ChainLog{Address: item.Address, Topics: item.Topics, Data: item.Data, BlockNumber: bn, BlockHash: item.BlockHash, TxHash: item.TxHash, LogIndex: li, Removed: item.Removed})
	}
	return logs, nil
}

func hexUint64(v uint64) string { return fmt.Sprintf("0x%x", v) }

func parseHexUint64(v string) (uint64, error) {
	v = strings.TrimSpace(v)
	if len(v) < 3 || !(strings.HasPrefix(v, "0x") || strings.HasPrefix(v, "0X")) {
		return 0, ErrInvalidChainState
	}
	n, err := strconv.ParseUint(v[2:], 16, 64)
	if err != nil {
		return 0, ErrInvalidChainState
	}
	return n, nil
}

func equalHex(a, b string) bool { return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b)) }
