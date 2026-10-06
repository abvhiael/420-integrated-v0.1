package orchestration

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

var ErrMalformedLifecycleChainData = errors.New("420media orchestration: malformed lifecycle chain data")

type EthereumLifecycleConfig struct {
	RPC                    ethadapter.RPC
	Signer                 ethadapter.Signer
	MarketAddress          string
	JobsSelector           [4]byte
	ReservedOperatorSelector [4]byte
	CreateAssignedSelector [4]byte
}

type EthereumLifecycleMarket struct {
	rpc      ethadapter.RPC
	signer   ethadapter.Signer
	market   string
	jobsSel  [4]byte
	reserveSel [4]byte
	createSel [4]byte
}

func NewEthereumLifecycleMarket(cfg EthereumLifecycleConfig) (*EthereumLifecycleMarket, error) {
	if cfg.RPC == nil || cfg.Signer == nil || !isHexAddress(cfg.MarketAddress) || cfg.JobsSelector == ([4]byte{}) || cfg.ReservedOperatorSelector == ([4]byte{}) || cfg.CreateAssignedSelector == ([4]byte{}) {
		return nil, ErrInvalidLifecycle
	}
	return &EthereumLifecycleMarket{rpc: cfg.RPC, signer: cfg.Signer, market: strings.ToLower(cfg.MarketAddress), jobsSel: cfg.JobsSelector, reserveSel: cfg.ReservedOperatorSelector, createSel: cfg.CreateAssignedSelector}, nil
}

func (m *EthereumLifecycleMarket) CreateJob(ctx context.Context, spec JobSpec) error {
	if spec.JobID == ([32]byte{}) || spec.StreamID == ([32]byte{}) || spec.JobKind == ([32]byte{}) || spec.CapabilityID == ([32]byte{}) || spec.InputRef == ([32]byte{}) || spec.OperatorID == ([32]byte{}) || spec.MaxSpend == 0 || spec.Deadline.IsZero() || spec.Deadline.Unix() <= 0 {
		return ErrInvalidLifecycle
	}
	data := make([]byte, 4, 4+9*32)
	copy(data, m.createSel[:])
	for _, word := range [][]byte{spec.JobID[:], spec.StreamID[:], spec.JobKind[:], spec.CapabilityID[:], spec.SLAID[:], spec.InputRef[:], uintWord(spec.MaxSpend), uintWord(uint64(spec.Deadline.Unix())), spec.OperatorID[:]} {
		data = append(data, word...)
	}
	_, err := m.signer.SendTransaction(ctx, m.market, data)
	return err
}

func (m *EthereumLifecycleMarket) Snapshot(ctx context.Context, jobID [32]byte) (JobSnapshot, error) {
	if jobID == ([32]byte{}) { return JobSnapshot{}, ErrInvalidLifecycle }
	jobRaw, err := m.call(ctx, m.jobsSel, jobID)
	if err != nil { return JobSnapshot{}, err }
	words, err := splitWords(jobRaw, 13)
	if err != nil { return JobSnapshot{}, err }
	statusValue, err := wordUint64Lifecycle(words[12])
	if err != nil || statusValue > 11 { return JobSnapshot{}, ErrMalformedLifecycleChainData }
	if statusValue == 0 { return JobSnapshot{}, ErrLifecycleJobNotFound }
	status, ok := lifecycleStatusFromOrdinal(uint8(statusValue))
	if !ok { return JobSnapshot{}, ErrMalformedLifecycleChainData }
	var operatorID, outputRef [32]byte
	copy(outputRef[:], words[6])
	copy(operatorID[:], words[7])
	if operatorID == ([32]byte{}) {
		reservedRaw, err := m.call(ctx, m.reserveSel, jobID)
		if err != nil { return JobSnapshot{}, err }
		reservedWords, err := splitWords(reservedRaw, 1)
		if err != nil { return JobSnapshot{}, err }
		copy(operatorID[:], reservedWords[0])
	}
	return JobSnapshot{JobID: jobID, OperatorID: operatorID, Status: status, OutputRef: outputRef}, nil
}

func (m *EthereumLifecycleMarket) call(ctx context.Context, selector [4]byte, jobID [32]byte) (string, error) {
	data := make([]byte, 4, 36)
	copy(data, selector[:])
	data = append(data, jobID[:]...)
	var out string
	if err := m.rpc.Call(ctx, "eth_call", []any{map[string]any{"to": m.market, "data": "0x" + hex.EncodeToString(data)}, "latest"}, &out); err != nil { return "", err }
	return out, nil
}

func lifecycleStatusFromOrdinal(v uint8) (LifecycleStatus, bool) {
	switch v {
	case 1: return LifecycleCreated, true
	case 2: return LifecycleAccepted, true
	case 3: return LifecycleFunded, true
	case 4: return LifecycleRunning, true
	case 5: return LifecycleResultCommitted, true
	case 6: return LifecycleVerified, true
	case 7: return LifecycleFailed, true
	case 8: return LifecycleSettled, true
	case 9: return LifecycleCancelled, true
	case 10: return LifecycleExpired, true
	case 11: return LifecycleRefunded, true
	default: return "", false
	}
}

func splitWords(encoded string, want int) ([][]byte, error) {
	if !strings.HasPrefix(encoded, "0x") || len(encoded)%2 != 0 { return nil, ErrMalformedLifecycleChainData }
	raw, err := hex.DecodeString(encoded[2:])
	if err != nil || len(raw) != want*32 { return nil, ErrMalformedLifecycleChainData }
	out := make([][]byte, want)
	for i := 0; i < want; i++ { out[i] = raw[i*32:(i+1)*32] }
	return out, nil
}

func wordUint64Lifecycle(word []byte) (uint64, error) {
	if len(word) != 32 { return 0, ErrMalformedLifecycleChainData }
	for _, b := range word[:24] { if b != 0 { return 0, ErrMalformedLifecycleChainData } }
	var v uint64
	for _, b := range word[24:] { v = v<<8 | uint64(b) }
	return v, nil
}

func uintWord(v uint64) []byte {
	out := make([]byte, 32)
	for i := 31; i >= 24; i-- { out[i] = byte(v); v >>= 8 }
	return out
}

func isHexAddress(v string) bool {
	if len(v) != 42 || !strings.HasPrefix(v, "0x") { return false }
	_, err := hex.DecodeString(v[2:]); return err == nil
}

var _ LifecycleMarket = (*EthereumLifecycleMarket)(nil)
