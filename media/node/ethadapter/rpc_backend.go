package ethadapter

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var (
	ErrMalformedRPCData = errors.New("420media ethadapter: malformed rpc data")
	ErrValueOverflow    = errors.New("420media ethadapter: value exceeds uint64")
)

type Signer interface {
	SendTransaction(ctx context.Context, to string, data []byte) (string, error)
}

type ABIConfig struct {
	JobsSelector         [4]byte
	AcceptSelector       [4]byte
	MarkRunningSelector  [4]byte
	CommitResultSelector [4]byte
	JobCreatedTopic      string
}

type RPCBackend struct {
	rpc        RPC
	signer     Signer
	cursor     CursorStore
	market     string
	operatorID [32]byte
	abi        ABIConfig
	startBlock uint64
}

func NewRPCBackend(rpc RPC, signer Signer, cursor CursorStore, market string, operatorID [32]byte, abi ABIConfig, startBlock uint64) (*RPCBackend, error) {
	if rpc == nil || signer == nil || cursor == nil { return nil, errors.New("420media ethadapter: missing rpc backend dependency") }
	if !validAddress(market) || operatorID == ([32]byte{}) { return nil, errors.New("420media ethadapter: invalid market/operator") }
	if abi.JobsSelector == ([4]byte{}) || abi.AcceptSelector == ([4]byte{}) || abi.MarkRunningSelector == ([4]byte{}) || abi.CommitResultSelector == ([4]byte{}) || !validTopic(abi.JobCreatedTopic) {
		return nil, errors.New("420media ethadapter: incomplete abi config")
	}
	return &RPCBackend{rpc: rpc, signer: signer, cursor: cursor, market: strings.ToLower(market), operatorID: operatorID, abi: abi, startBlock: startBlock}, nil
}

type rpcLog struct {
	BlockNumber string   `json:"blockNumber"`
	Topics      []string `json:"topics"`
	Removed     bool     `json:"removed"`
}

func (b *RPCBackend) ListPendingJobs(ctx context.Context) ([]ContractJob, error) {
	last, err := b.cursor.Load()
	if err != nil { return nil, err }
	from := b.startBlock
	if last >= from { from = last + 1 }
	var latestHex string
	if err := b.rpc.Call(ctx, "eth_blockNumber", []any{}, &latestHex); err != nil { return nil, err }
	latest, err := parseHexUint64(latestHex)
	if err != nil { return nil, err }
	if from > latest { return nil, nil }
	filter := map[string]any{"address": b.market, "fromBlock": hexUint(from), "toBlock": hexUint(latest), "topics": []any{b.abi.JobCreatedTopic}}
	var logs []rpcLog
	if err := b.rpc.Call(ctx, "eth_getLogs", []any{filter}, &logs); err != nil { return nil, err }
	seen := make(map[[32]byte]struct{})
	jobs := make([]ContractJob, 0, len(logs))
	for _, log := range logs {
		if log.Removed { continue }
		if len(log.Topics) < 2 { return nil, ErrMalformedRPCData }
		id, err := parseBytes32(log.Topics[1])
		if err != nil { return nil, err }
		if _, ok := seen[id]; ok { continue }
		seen[id] = struct{}{}
		job, err := b.Job(ctx, id)
		if err != nil { return nil, err }
		if job.Status == 1 { jobs = append(jobs, job) }
	}
	if err := b.cursor.Save(latest); err != nil { return nil, err }
	return jobs, nil
}

func (b *RPCBackend) Job(ctx context.Context, jobID [32]byte) (ContractJob, error) {
	data := appendSelector(b.abi.JobsSelector, jobID[:])
	var out string
	if err := b.rpc.Call(ctx, "eth_call", []any{map[string]any{"to": b.market, "data": "0x" + hex.EncodeToString(data)}, "latest"}, &out); err != nil { return ContractJob{}, err }
	return decodeJob(jobID, out)
}

func (b *RPCBackend) AcceptJob(ctx context.Context, jobID [32]byte) error {
	data := appendSelector(b.abi.AcceptSelector, jobID[:], b.operatorID[:])
	_, err := b.signer.SendTransaction(ctx, b.market, data)
	return err
}

func (b *RPCBackend) MarkRunning(ctx context.Context, jobID [32]byte) error {
	_, err := b.signer.SendTransaction(ctx, b.market, appendSelector(b.abi.MarkRunningSelector, jobID[:]))
	return err
}

func (b *RPCBackend) CommitResult(ctx context.Context, jobID [32]byte, outputRef [32]byte) error {
	if outputRef == ([32]byte{}) { return ErrInvalidJob }
	_, err := b.signer.SendTransaction(ctx, b.market, appendSelector(b.abi.CommitResultSelector, jobID[:], outputRef[:]))
	return err
}

func appendSelector(selector [4]byte, words ...[]byte) []byte {
	out := make([]byte, 4, 4+32*len(words))
	copy(out, selector[:])
	for _, word := range words {
		if len(word) != 32 { panic("ethadapter: ABI word must be 32 bytes") }
		out = append(out, word...)
	}
	return out
}

func decodeJob(id [32]byte, encoded string) (ContractJob, error) {
	raw, err := decodeHex(encoded)
	if err != nil { return ContractJob{}, err }
	if len(raw) != 13*32 { return ContractJob{}, ErrMalformedRPCData }
	word := func(i int) []byte { return raw[i*32:(i+1)*32] }
	maxSpend, err := wordUint64(word(9)); if err != nil { return ContractJob{}, err }
	funded, err := wordUint64(word(10)); if err != nil { return ContractJob{}, err }
	deadline, err := wordUint64(word(11)); if err != nil { return ContractJob{}, err }
	status64, err := wordUint64(word(12)); if err != nil || status64 > 255 { return ContractJob{}, ErrMalformedRPCData }
	var streamID, kind, capabilityID, slaID, inputRef, operatorID [32]byte
	copy(streamID[:], word(1)); copy(kind[:], word(2)); copy(capabilityID[:], word(3)); copy(slaID[:], word(4)); copy(inputRef[:], word(5)); copy(operatorID[:], word(7))
	return ContractJob{ID:id, Requester:"0x"+hex.EncodeToString(word(0)[12:]), StreamID:streamID, Kind:kind, CapabilityID:capabilityID, SLAID:slaID, InputRef:inputRef, OperatorID:operatorID, MaxSpend:maxSpend, FundedAmount:funded, DeadlineUnix:deadline, Status:uint8(status64)}, nil
}

func wordUint64(word []byte) (uint64, error) {
	if len(word) != 32 { return 0, ErrMalformedRPCData }
	for _, b := range word[:24] { if b != 0 { return 0, ErrValueOverflow } }
	var v uint64
	for _, b := range word[24:] { v = v<<8 | uint64(b) }
	return v, nil
}

func decodeHex(v string) ([]byte, error) {
	if !strings.HasPrefix(v, "0x") || len(v)%2 != 0 { return nil, ErrMalformedRPCData }
	b, err := hex.DecodeString(v[2:]); if err != nil { return nil, ErrMalformedRPCData }
	return b, nil
}

func parseBytes32(v string) ([32]byte, error) {
	var out [32]byte
	b, err := decodeHex(v); if err != nil || len(b) != 32 { return out, ErrMalformedRPCData }
	copy(out[:], b); return out, nil
}

func parseHexUint64(v string) (uint64, error) {
	if !strings.HasPrefix(v, "0x") { return 0, ErrMalformedRPCData }
	x, err := strconv.ParseUint(v[2:], 16, 64); if err != nil { return 0, ErrMalformedRPCData }
	return x, nil
}

func hexUint(v uint64) string { return fmt.Sprintf("0x%x", v) }
func validAddress(v string) bool { if len(v) != 42 || !strings.HasPrefix(v, "0x") { return false }; _, err := hex.DecodeString(v[2:]); return err == nil }
func validTopic(v string) bool { if len(v) != 66 || !strings.HasPrefix(v, "0x") { return false }; _, err := hex.DecodeString(v[2:]); return err == nil }

var _ Backend = (*RPCBackend)(nil)
