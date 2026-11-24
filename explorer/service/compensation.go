package service

import (
	"context"
	"errors"
	"regexp"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/explorer/indexerclient"
	"github.com/420integrated/420-integrated/indexer/model"
)

const CompensationProtocol = indexerclient.CompensationProtocol

var (
	ErrCompensationUnavailable = errors.New("compensation records unavailable")
	ErrInvalidCompensationHash = errors.New("invalid transaction hash")
	hashPattern                = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)
	addressPattern             = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	decimalPattern             = regexp.MustCompile(`^[0-9]+$`)
)

type CompensationEvent = indexerclient.CompensationEvent

type CompensationView struct {
	Events        []CompensationEvent `json:"events"`
	Finality      model.Finality      `json:"finality,omitempty"`
	Confirmations uint64              `json:"confirmations"`
}

type compensationReader interface {
	CompensationEvents(context.Context, uint64, string) ([]CompensationEvent, error)
}

func validCompensationFields(event CompensationEvent) bool {
	f := event.Fields
	switch event.EventName {
	case "DevelopmentCompensationForwarded":
		return hashPattern.MatchString(f["contributionId"]) && hashPattern.MatchString(f["sourceApplicationId"]) &&
			hashPattern.MatchString(f["revenueRef"]) && hashPattern.MatchString(f["policyRef"]) &&
			addressPattern.MatchString(f["asset"]) && addressPattern.MatchString(f["source"]) &&
			addressPattern.MatchString(f["beneficiary"]) && decimalPattern.MatchString(f["grossProtocolRevenue"]) &&
			decimalPattern.MatchString(f["compensationBps"]) && decimalPattern.MatchString(f["compensationAmount"])
	case "FounderCompensationDeposited":
		return addressPattern.MatchString(f["sourceVault"]) && decimalPattern.MatchString(f["amount"])
	case "FounderTokenCompensationCredited":
		return addressPattern.MatchString(f["sourceVault"]) && addressPattern.MatchString(f["token"]) &&
			hashPattern.MatchString(f["contributionId"]) && decimalPattern.MatchString(f["amount"])
	case "FounderCompensationClaimed":
		return addressPattern.MatchString(f["beneficiary"]) && addressPattern.MatchString(f["asset"]) &&
			decimalPattern.MatchString(f["amount"])
	default:
		return false
	}
}

func (s *Service) Compensation(ctx context.Context, hash string) (CompensationView, error) {
	if !hashPattern.MatchString(hash) {
		return CompensationView{}, ErrInvalidCompensationHash
	}
	reader, ok := s.indexer.(compensationReader)
	if !ok {
		return CompensationView{}, ErrCompensationUnavailable
	}
	events, err := reader.CompensationEvents(ctx, s.requiredChainID, hash)
	if err != nil {
		return CompensationView{}, ErrCompensationUnavailable
	}
	view := CompensationView{Events: []CompensationEvent{}}
	if len(events) == 0 {
		return view, nil
	}
	detail, err := s.TransactionDetail(ctx, hash)
	if err != nil || detail.Receipt.Status != 1 || !strings.EqualFold(hash, detail.Transaction.Hash) {
		return CompensationView{}, ErrCompensationUnavailable
	}
	tx := detail.Transaction
	logs := make(map[uint64]string, len(detail.Logs))
	for _, log := range detail.Logs {
		logs[log.LogIndex] = log.Address
	}
	seen := make(map[uint64]bool, len(events))
	for _, event := range events {
		if seen[event.LogIndex] || event.Protocol != CompensationProtocol || !validCompensationFields(event) ||
			event.ChainID != strconv.FormatUint(tx.ChainID, 10) || event.BlockNumber != strconv.FormatUint(tx.BlockNumber, 10) ||
			!strings.EqualFold(event.BlockHash, tx.BlockHash) || !strings.EqualFold(event.TransactionHash, tx.Hash) ||
			event.TransactionIndex != tx.Index || !addressPattern.MatchString(event.ContractAddress) || !strings.EqualFold(logs[event.LogIndex], event.ContractAddress) {
			return CompensationView{}, ErrCompensationUnavailable
		}
		seen[event.LogIndex] = true
	}

	status, err := s.NetworkStatus(ctx)
	if err != nil || !status.Ready || status.IndexedHeight < tx.BlockNumber {
		return CompensationView{}, ErrCompensationUnavailable
	}
	// Re-read the block after collecting projections so a replacement during
	// the request cannot inherit finality from the former canonical block.
	block, err := s.indexer.Block(ctx, tx.BlockNumber)
	if err != nil || block.ChainID != tx.ChainID || block.Number != tx.BlockNumber ||
		!strings.EqualFold(block.Hash, tx.BlockHash) {
		return CompensationView{}, ErrCompensationUnavailable
	}
	switch block.Finality {
	case model.FinalityHead, model.FinalitySafe, model.FinalityFinalized:
	default:
		return CompensationView{}, ErrCompensationUnavailable
	}
	view.Events = events
	view.Finality = block.Finality
	view.Confirmations = status.IndexedHeight - tx.BlockNumber + 1
	return view, nil
}
