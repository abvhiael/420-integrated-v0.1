package engine

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// NativeLog preserves the Ethereum-compatible ABI/log fields without pretending
// a consensus system call was an ordinary transaction.
type NativeLog struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	BlockHash        string   `json:"blockHash"`
	BlockNumber      string   `json:"blockNumber"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex string   `json:"transactionIndex"`
	LogIndex         string   `json:"logIndex"`
	Removed          bool     `json:"removed"`
}
type NativeLogArchive struct {
	BlockHash   Hash32      `json:"blockHash"`
	BlockNumber string      `json:"blockNumber"`
	BatchRoot   Hash32      `json:"batchRoot"`
	Logs        []NativeLog `json:"logs"`
}

func (c *Client) CanonicalNativeLogs(ctx context.Context, number uint64, hash, root Hash32) ([]NativeLog, error) {
	var archive NativeLogArchive
	if err := c.Call(ctx, "engine420_getSystemCallLogsV1", []any{hash}, &archive); err != nil {
		return nil, err
	}
	if archive.BlockHash != hash || archive.BlockNumber != hexQuantity(number) || archive.BatchRoot != root || archive.Logs == nil {
		return nil, fmt.Errorf("native archive checkpoint mismatch")
	}
	zero := "0x0000000000000000000000000000000000000000000000000000000000000000"
	var previous uint64
	for i, log := range archive.Logs {
		index, err := strconv.ParseUint(strings.TrimPrefix(log.LogIndex, "0x"), 16, 64)
		if err != nil || !strings.HasPrefix(log.LogIndex, "0x") || (i > 0 && index <= previous) {
			return nil, fmt.Errorf("native log ordering mismatch")
		}
		previous = index
		if log.Removed || log.BlockHash != string(hash) || log.BlockNumber != hexQuantity(number) || log.TransactionHash != zero {
			return nil, fmt.Errorf("native log provenance mismatch")
		}
	}
	return archive.Logs, nil
}
