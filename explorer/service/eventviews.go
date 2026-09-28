package service

import (
	"encoding/hex"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

// RawLogView is Explorer's stable raw-event presentation contract. It keeps
// canonical log provenance and complete raw topics/data visible without
// treating ABI-decoded labels as authority.
type RawLogView struct {
	ChainID          uint64   `json:"chainId"`
	BlockNumber      uint64   `json:"blockNumber"`
	BlockHash        string   `json:"blockHash"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex uint64   `json:"transactionIndex"`
	LogIndex         uint64   `json:"logIndex"`
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	DecoderVersion   string   `json:"decoderVersion,omitempty"`
}

func validateRawHexBytes(value, label string, exactBytes int, allowEmpty bool) error {
	value = strings.TrimSpace(value)
	if value == "" && allowEmpty {
		return nil
	}
	if !strings.HasPrefix(value, "0x") {
		return errors.New("420Indexer returned " + label + " without 0x prefix")
	}
	raw := value[2:]
	if len(raw)%2 != 0 {
		return errors.New("420Indexer returned malformed " + label)
	}
	decoded, err := hex.DecodeString(raw)
	if err != nil {
		return errors.New("420Indexer returned malformed " + label)
	}
	if exactBytes >= 0 && len(decoded) != exactBytes {
		return errors.New("420Indexer returned invalid " + label + " length")
	}
	return nil
}

func rawLogView(log model.LogRecord) (RawLogView, error) {
	if err := validateRawHexBytes(log.Address, "log address", 20, true); err != nil {
		return RawLogView{}, err
	}
	for _, topic := range log.Topics {
		if err := validateRawHexBytes(topic, "log topic", 32, false); err != nil {
			return RawLogView{}, err
		}
	}
	if err := validateRawHexBytes(log.Data, "log data", -1, true); err != nil {
		return RawLogView{}, err
	}
	return RawLogView{
		ChainID: log.ChainID,
		BlockNumber: log.BlockNumber,
		BlockHash: log.BlockHash,
		TransactionHash: log.TransactionHash,
		TransactionIndex: log.TransactionIndex,
		LogIndex: log.LogIndex,
		Address: log.Address,
		Topics: append([]string(nil), log.Topics...),
		Data: log.Data,
		DecoderVersion: log.DecoderVersion,
	}, nil
}

func rawLogViews(logs []model.LogRecord) ([]RawLogView, error) {
	out := make([]RawLogView, 0, len(logs))
	for _, log := range logs {
		view, err := rawLogView(log)
		if err != nil {
			return nil, err
		}
		out = append(out, view)
	}
	return out, nil
}
