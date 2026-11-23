package service

import (
	"context"
	"errors"
	"strings"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

var stakeExplorerEvents = map[string]bool{
	"CommunityValidatorReserveBound":true,
	"ProtocolCreditReceived":true,
	"PendingProtocolCreditReturned":true,
	"ValidatorRegistered":true,
	"OwnedBondToppedUp":true,
	"ProtocolCreditReplaced":true,
	"ValidatorBondWithdrawn":true,
	"ConsensusStateApplied":true,
	"ExitNoticeApplied":true,
	"SlashApplied":true,
	"RotationSnapshotApplied":true,
	"ActiveTargetChanged":true,

}

var stakeExplorerRewardEvents = map[string]bool{
	"RewardApplied":                     true,
	"SponsoredValidatorRewardAllocated": true,
	"CommunityRewardBackingReceived":    true,
	"CommunityRewardSettled":            true,
	"NativeRewardPaid":                  true,
}

type stakeIndexerReader interface {
	StakeActivity(context.Context, string, string, uint32) (indexerapi.StakeActivityPage, error)
}

type StakeActivityView struct {
	indexerapi.StakeActivityPage
	Count int `json:"count"`
}

func expectedStakeFinality(meta indexerapi.PageMeta, height uint64) model.Finality {
	if height <= meta.FinalizedHeight { return model.FinalityFinalized }
	if height <= meta.SafeHeight { return model.FinalitySafe }
	return model.FinalityHead
}

func (s *Service) StakeActivity(ctx context.Context, validatorID, address string, limit uint32) (StakeActivityView, error) {
	if limit == 0 { limit = 50 }
	reader, ok := s.indexer.(stakeIndexerReader)
	if !ok { return StakeActivityView{}, errors.New("420Indexer Stake activity capability unavailable") }
	page, err := reader.StakeActivity(ctx, strings.TrimSpace(validatorID), strings.TrimSpace(address), limit)
	if err != nil { return StakeActivityView{}, err }
	if page.CanonicalAuthority { return StakeActivityView{}, errors.New("420Indexer Stake activity overpromoted canonical authority") }
	if err := s.requireRecordChain(page.Meta.ChainID); err != nil { return StakeActivityView{}, err }
	if page.Meta.FinalizedHeight > page.Meta.SafeHeight || page.Meta.SafeHeight > page.Meta.SnapshotHeight {
		return StakeActivityView{}, errors.New("420Indexer returned inconsistent Stake finality boundaries")
	}
	for _, record := range page.Records {
		if err := s.requireRecordChain(record.ChainID); err != nil { return StakeActivityView{}, err }
		if record.BlockNumber > page.Meta.SnapshotHeight {
			return StakeActivityView{}, errors.New("420Indexer returned Stake event beyond snapshot")
		}
		reward := stakeExplorerRewardEvents[record.EventName]
		if !stakeExplorerEvents[record.EventName] && !reward {
			return StakeActivityView{}, errors.New("420Indexer returned unknown Stake event")
		}
		expectedAddress := indexerapi.StakeValidatorRegistryAddress
		if reward { expectedAddress = indexerapi.StakeRewardControllerAddress }
		if !strings.EqualFold(record.ContractAddress, expectedAddress) {
			return StakeActivityView{}, errors.New("420Indexer returned Stake event from wrong canonical contract")
		}
		if record.Finality != expectedStakeFinality(page.Meta, record.BlockNumber) {
			return StakeActivityView{}, errors.New("420Indexer returned Stake event with inconsistent finality")
		}
		if page.ValidatorID != "" && !strings.EqualFold(record.ValidatorID, page.ValidatorID) {
			return StakeActivityView{}, errors.New("420Indexer returned Stake event outside validator filter")
		}
		if page.Address != "" {
			found:=false
			for _, candidate:=range record.Addresses { if strings.EqualFold(candidate,page.Address){found=true;break} }
			if !found { return StakeActivityView{}, errors.New("420Indexer returned Stake event outside address filter") }
		}
	}
	return StakeActivityView{StakeActivityPage:page,Count:len(page.Records)},nil
}
