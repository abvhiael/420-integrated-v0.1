package assets

import (
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

const (
	zeroAddress       = "0x0000000000000000000000000000000000000000"
	nativeLogIndex    = int64(-1)
	ercTransferTopic  = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	erc1155Single     = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62"
	erc1155Batch      = "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb"
)

var ErrMalformedAssetEvent = errors.New("malformed asset transfer event")

func AssetKey(kind, contract, tokenID string) string {
	if kind == "native" { return "native:420" }
	return kind + ":" + strings.ToLower(contract) + ":" + tokenID
}

func DecodeBundle(txs []model.TransactionRecord, logs []model.LogRecord) ([]model.AssetTransferRecord, error) {
	out := make([]model.AssetTransferRecord, 0)
	for _, tx := range txs {
		if transfer, ok, err := decodeNative(tx); err != nil { return nil, err } else if ok { out = append(out, transfer) }
	}
	for _, lg := range logs {
		transfers, err := DecodeLog(lg)
		if err != nil { return nil, err }
		out = append(out, transfers...)
	}
	return out, nil
}

func decodeNative(tx model.TransactionRecord) (model.AssetTransferRecord, bool, error) {
	if tx.To == "" || tx.ValueWei == "" || tx.ValueWei == "0" { return model.AssetTransferRecord{}, false, nil }
	amount, ok := new(big.Int).SetString(tx.ValueWei, 10)
	if !ok || amount.Sign() < 0 { return model.AssetTransferRecord{}, false, fmt.Errorf("invalid transaction value: %s", tx.ValueWei) }
	if amount.Sign() == 0 { return model.AssetTransferRecord{}, false, nil }
	return model.AssetTransferRecord{
		ChainID: tx.ChainID, BlockNumber: tx.BlockNumber, BlockHash: tx.BlockHash,
		TransactionHash: tx.Hash, TransactionIndex: tx.Index, LogIndex: nativeLogIndex,
		AssetKey: "native:420", AssetKind: "native", From: strings.ToLower(tx.From),
		To: strings.ToLower(tx.To), Amount: amount.String(),
	}, true, nil
}

func DecodeLog(lg model.LogRecord) ([]model.AssetTransferRecord, error) {
	if len(lg.Topics) == 0 { return nil, nil }
	topic0 := strings.ToLower(lg.Topics[0])
	switch topic0 {
	case ercTransferTopic:
		if len(lg.Topics) == 4 {
			from, err := addressTopic(lg.Topics[1]); if err != nil { return nil, err }
			to, err := addressTopic(lg.Topics[2]); if err != nil { return nil, err }
			tokenID, err := topicUint(lg.Topics[3]); if err != nil { return nil, err }
			return []model.AssetTransferRecord{record(lg, "erc721", tokenID, from, to, "1")}, nil
		}
		if len(lg.Topics) == 3 {
			from, err := addressTopic(lg.Topics[1]); if err != nil { return nil, err }
			to, err := addressTopic(lg.Topics[2]); if err != nil { return nil, err }
			amount, err := word(lg.Data, 0); if err != nil { return nil, err }
			return []model.AssetTransferRecord{record(lg, "erc20", "", from, to, amount.String())}, nil
		}
		return nil, ErrMalformedAssetEvent
	case erc1155Single:
		if len(lg.Topics) != 4 { return nil, ErrMalformedAssetEvent }
		from, err := addressTopic(lg.Topics[2]); if err != nil { return nil, err }
		to, err := addressTopic(lg.Topics[3]); if err != nil { return nil, err }
		id, err := word(lg.Data, 0); if err != nil { return nil, err }
		amount, err := word(lg.Data, 1); if err != nil { return nil, err }
		return []model.AssetTransferRecord{record(lg, "erc1155", id.String(), from, to, amount.String())}, nil
	case erc1155Batch:
		if len(lg.Topics) != 4 { return nil, ErrMalformedAssetEvent }
		from, err := addressTopic(lg.Topics[2]); if err != nil { return nil, err }
		to, err := addressTopic(lg.Topics[3]); if err != nil { return nil, err }
		idsOffset, err := word(lg.Data, 0); if err != nil { return nil, err }
		valuesOffset, err := word(lg.Data, 1); if err != nil { return nil, err }
		ids, err := uintArray(lg.Data, idsOffset); if err != nil { return nil, err }
		values, err := uintArray(lg.Data, valuesOffset); if err != nil { return nil, err }
		if len(ids) != len(values) { return nil, ErrMalformedAssetEvent }
		out := make([]model.AssetTransferRecord, 0, len(ids))
		for i := range ids { out = append(out, record(lg, "erc1155", ids[i].String(), from, to, values[i].String())) }
		return out, nil
	default:
		return nil, nil
	}
}

func record(lg model.LogRecord, kind, tokenID, from, to, amount string) model.AssetTransferRecord {
	contract := strings.ToLower(lg.Address)
	return model.AssetTransferRecord{
		ChainID: lg.ChainID, BlockNumber: lg.BlockNumber, BlockHash: lg.BlockHash,
		TransactionHash: lg.TransactionHash, TransactionIndex: lg.TransactionIndex, LogIndex: int64(lg.LogIndex),
		AssetKey: AssetKey(kind, contract, tokenID), AssetKind: kind, ContractAddress: contract,
		TokenID: tokenID, From: from, To: to, Amount: amount,
	}
}

func addressTopic(topic string) (string, error) {
	topic = strings.ToLower(topic)
	if len(topic) != 66 || !strings.HasPrefix(topic, "0x") { return "", ErrMalformedAssetEvent }
	if _, ok := new(big.Int).SetString(topic[2:], 16); !ok { return "", ErrMalformedAssetEvent }
	return "0x" + topic[len(topic)-40:], nil
}

func topicUint(topic string) (string, error) {
	topic = strings.TrimPrefix(strings.ToLower(topic), "0x")
	if len(topic) != 64 { return "", ErrMalformedAssetEvent }
	v, ok := new(big.Int).SetString(topic, 16); if !ok { return "", ErrMalformedAssetEvent }
	return v.String(), nil
}

func word(data string, index int) (*big.Int, error) {
	data = strings.TrimPrefix(strings.ToLower(data), "0x")
	start := index * 64
	if start < 0 || start+64 > len(data) { return nil, ErrMalformedAssetEvent }
	v, ok := new(big.Int).SetString(data[start:start+64], 16); if !ok { return nil, ErrMalformedAssetEvent }
	return v, nil
}

func uintArray(data string, offsetBytes *big.Int) ([]*big.Int, error) {
	if !offsetBytes.IsUint64() || new(big.Int).Mod(offsetBytes, big.NewInt(32)).Sign() != 0 { return nil, ErrMalformedAssetEvent }
	offsetWords := offsetBytes.Uint64() / 32
	if offsetWords > 100000 { return nil, ErrMalformedAssetEvent }
	length, err := word(data, int(offsetWords)); if err != nil { return nil, err }
	if !length.IsUint64() || length.Uint64() > 100000 { return nil, ErrMalformedAssetEvent }
	out := make([]*big.Int, 0, length.Uint64())
	for i := uint64(0); i < length.Uint64(); i++ {
		v, err := word(data, int(offsetWords+1+i)); if err != nil { return nil, err }
		out = append(out, v)
	}
	return out, nil
}

func IsZeroAddress(address string) bool { return strings.EqualFold(address, zeroAddress) }
