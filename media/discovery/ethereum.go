package discovery

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

var ErrMalformedChainData = errors.New("420media discovery: malformed chain data")

type EthereumConfig struct {
	RPC                    ethadapter.RPC
	RegistryAddress        string
	CapabilityChangedTopic string
	OperatorsSelector      string
	OperationalSelector    string
	FromBlock              uint64
}

type EthereumDiscovery struct {
	cfg EthereumConfig
}

func NewEthereumDiscovery(cfg EthereumConfig) (*EthereumDiscovery, error) {
	if cfg.RPC == nil || !validHexAddress(cfg.RegistryAddress) || !validHexWord(cfg.CapabilityChangedTopic, 32) || !validHexWord(cfg.OperatorsSelector, 4) || !validHexWord(cfg.OperationalSelector, 4) {
		return nil, ErrInvalidRequest
	}
	cfg.RegistryAddress = strings.ToLower(cfg.RegistryAddress)
	return &EthereumDiscovery{cfg: cfg}, nil
}

// OperatorIDs implements OperatorIndex by reconstructing the latest capability-enabled
// state from MediaOperatorRegistry420 CapabilityChanged events. The result is still only
// an accelerator: IndexedSource must revalidate every ID through CanonicalProvider.
func (e *EthereumDiscovery) OperatorIDs(ctx context.Context, capabilityID [32]byte) ([][32]byte, error) {
	if capabilityID == ([32]byte{}) {
		return nil, ErrInvalidRequest
	}
	var logs []rpcLog
	params := []any{map[string]any{
		"address": e.cfg.RegistryAddress,
		"fromBlock": quantity(e.cfg.FromBlock),
		"toBlock": "latest",
		"topics": []any{e.cfg.CapabilityChangedTopic, nil, "0x" + hex.EncodeToString(capabilityID[:])},
	}}
	if err := e.cfg.RPC.Call(ctx, "eth_getLogs", params, &logs); err != nil {
		return nil, err
	}
	sort.SliceStable(logs, func(i, j int) bool {
		bi, _ := parseQuantity(logs[i].BlockNumber)
		bj, _ := parseQuantity(logs[j].BlockNumber)
		if bi != bj { return bi < bj }
		li, _ := parseQuantity(logs[i].LogIndex)
		lj, _ := parseQuantity(logs[j].LogIndex)
		return li < lj
	})

	enabled := make(map[[32]byte]bool)
	for _, log := range logs {
		if log.Removed || len(log.Topics) != 3 || !equalHex(log.Topics[0], e.cfg.CapabilityChangedTopic) || !equalHex(log.Topics[2], "0x"+hex.EncodeToString(capabilityID[:])) {
			return nil, ErrMalformedChainData
		}
		opID, err := parseBytes32(log.Topics[1])
		if err != nil || opID == ([32]byte{}) {
			return nil, ErrMalformedChainData
		}
		words, err := decodeWords(log.Data)
		if err != nil || len(words) != 1 {
			return nil, ErrMalformedChainData
		}
		v, err := decodeBool(words[0])
		if err != nil {
			return nil, ErrMalformedChainData
		}
		enabled[opID] = v
	}

	ids := make([][32]byte, 0, len(enabled))
	for id, on := range enabled {
		if on { ids = append(ids, id) }
	}
	sort.Slice(ids, func(i, j int) bool { return strings.Compare(hex.EncodeToString(ids[i][:]), hex.EncodeToString(ids[j][:])) < 0 })
	return ids, nil
}

// CanonicalProvider implements RegistryReader with direct eth_call reads against the
// canonical MediaOperatorRegistry420 mapping and isOperationalFor view.
func (e *EthereumDiscovery) CanonicalProvider(ctx context.Context, operatorID, capabilityID [32]byte) (Provider, error) {
	if operatorID == ([32]byte{}) || capabilityID == ([32]byte{}) {
		return Provider{}, ErrInvalidRequest
	}
	operatorData := e.cfg.OperatorsSelector + hex.EncodeToString(operatorID[:])
	var rawOperator string
	if err := e.cfg.RPC.Call(ctx, "eth_call", []any{map[string]any{"to": e.cfg.RegistryAddress, "data": operatorData}, "latest"}, &rawOperator); err != nil {
		return Provider{}, err
	}
	words, err := decodeWords(rawOperator)
	if err != nil || len(words) != 9 {
		return Provider{}, ErrMalformedChainData
	}
	metadataHash := words[2]
	revision64, err := decodeUint(words[6])
	if err != nil || revision64 > uint64(^uint32(0)) {
		return Provider{}, ErrMalformedChainData
	}
	state, err := decodeUint(words[7])
	if err != nil || state > 4 {
		return Provider{}, ErrMalformedChainData
	}
	exists, err := decodeBool(words[8])
	if err != nil {
		return Provider{}, ErrMalformedChainData
	}

	operationalData := e.cfg.OperationalSelector + hex.EncodeToString(operatorID[:]) + hex.EncodeToString(capabilityID[:])
	var rawOperational string
	if err := e.cfg.RPC.Call(ctx, "eth_call", []any{map[string]any{"to": e.cfg.RegistryAddress, "data": operationalData}, "latest"}, &rawOperational); err != nil {
		return Provider{}, err
	}
	opWords, err := decodeWords(rawOperational)
	if err != nil || len(opWords) != 1 {
		return Provider{}, ErrMalformedChainData
	}
	operational, err := decodeBool(opWords[0])
	if err != nil {
		return Provider{}, ErrMalformedChainData
	}

	caps := map[[32]byte]struct{}{}
	if exists && state == 2 && operational {
		caps[capabilityID] = struct{}{}
	}
	return Provider{
		OperatorID: operatorID,
		MetadataHash: metadataHash,
		Revision: uint32(revision64),
		Active: exists && state == 2 && operational,
		Capabilities: caps,
	}, nil
}

type rpcLog struct {
	BlockNumber string   `json:"blockNumber"`
	LogIndex    string   `json:"logIndex"`
	Topics      []string `json:"topics"`
	Data        string   `json:"data"`
	Removed     bool     `json:"removed"`
}

func quantity(v uint64) string { return fmt.Sprintf("0x%x", v) }

func parseQuantity(v string) (uint64, error) {
	if !strings.HasPrefix(v, "0x") || len(v) < 3 { return 0, ErrMalformedChainData }
	n, err := strconv.ParseUint(v[2:], 16, 64)
	if err != nil { return 0, ErrMalformedChainData }
	return n, nil
}

func validHexAddress(v string) bool { return validHexWord(v, 20) }

func validHexWord(v string, bytes int) bool {
	if !strings.HasPrefix(v, "0x") || len(v) != 2+bytes*2 { return false }
	_, err := hex.DecodeString(v[2:])
	return err == nil
}

func equalHex(a, b string) bool { return strings.EqualFold(a, b) }

func parseBytes32(v string) ([32]byte, error) {
	var out [32]byte
	if !validHexWord(v, 32) { return out, ErrMalformedChainData }
	b, _ := hex.DecodeString(v[2:])
	copy(out[:], b)
	return out, nil
}

func decodeWords(raw string) ([][32]byte, error) {
	if !strings.HasPrefix(raw, "0x") || (len(raw)-2)%64 != 0 { return nil, ErrMalformedChainData }
	b, err := hex.DecodeString(raw[2:])
	if err != nil { return nil, ErrMalformedChainData }
	words := make([][32]byte, len(b)/32)
	for i := range words { copy(words[i][:], b[i*32:(i+1)*32]) }
	return words, nil
}

func decodeUint(word [32]byte) (uint64, error) {
	for _, b := range word[:24] { if b != 0 { return 0, ErrMalformedChainData } }
	var n uint64
	for _, b := range word[24:] { n = n<<8 | uint64(b) }
	return n, nil
}

func decodeBool(word [32]byte) (bool, error) {
	n, err := decodeUint(word)
	if err != nil || n > 1 { return false, ErrMalformedChainData }
	return n == 1, nil
}
