package service

import (
	"context"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

type stakeCapableFake struct {
	*fakeIndexer
	page indexerapi.StakeActivityPage
	err error
}

func (f *stakeCapableFake) StakeActivity(context.Context, string, string, uint32) (indexerapi.StakeActivityPage, error) {
	return f.page, f.err
}

func validStakePage420() indexerapi.StakeActivityPage {
	return indexerapi.StakeActivityPage{
		Meta:indexerapi.PageMeta{ChainID:420,SnapshotHeight:12,SnapshotHash:"0x12",SafeHeight:11,FinalizedHeight:10,SchemaVersion:"v1"},
		Records:[]model.StakeActivityRecord{
			{ChainID:420,BlockNumber:12,BlockHash:"0x12",TransactionHash:"0xtx12",ContractAddress:indexerapi.StakeRewardControllerAddress,EventName:"RewardApplied",Addresses:[]string{"0x1111111111111111111111111111111111111111"},Finality:model.FinalityHead},
			{ChainID:420,BlockNumber:11,BlockHash:"0x11",TransactionHash:"0xtx11",ContractAddress:indexerapi.StakeValidatorRegistryAddress,EventName:"SlashApplied",ValidatorID:"0x"+strings.Repeat("a",64),Finality:model.FinalitySafe},
			{ChainID:420,BlockNumber:10,BlockHash:"0x10",TransactionHash:"0xtx10",ContractAddress:indexerapi.StakeValidatorRegistryAddress,EventName:"ValidatorRegistered",ValidatorID:"0x"+strings.Repeat("a",64),Finality:model.FinalityFinalized},
		},
		CanonicalAuthority:false,
	}
}

func TestStakeActivityViewPreservesIndexerAuthorityAndFinality(t *testing.T) {
	idx:=&stakeCapableFake{fakeIndexer:&fakeIndexer{},page:validStakePage420()}
	svc,err:=New(idx,420,time.Minute);if err!=nil{t.Fatal(err)}
	view,err:=svc.StakeActivity(context.Background(),"","",50);if err!=nil{t.Fatal(err)}
	if view.Count!=3 {t.Fatalf("count=%d",view.Count)}
	if view.CanonicalAuthority {t.Fatal("Explorer Stake view claimed canonical authority")}
	if view.Records[0].Finality!=model.FinalityHead||view.Records[1].Finality!=model.FinalitySafe||view.Records[2].Finality!=model.FinalityFinalized {
		t.Fatalf("finality drift: %+v",view.Records)
	}
}

func TestStakeActivityViewRejectsAuthorityContractAndFinalityDrift(t *testing.T) {
	cases:=[]struct{name string;mutate func(*indexerapi.StakeActivityPage)}{
		{"authority",func(p *indexerapi.StakeActivityPage){p.CanonicalAuthority=true}},
		{"contract",func(p *indexerapi.StakeActivityPage){p.Records[0].ContractAddress=indexerapi.StakeValidatorRegistryAddress}},
		{"finality",func(p *indexerapi.StakeActivityPage){p.Records[1].Finality=model.FinalityHead}},
		{"unknown-event",func(p *indexerapi.StakeActivityPage){p.Records[1].EventName="SyntheticValidatorActivated"}},
		{"wrong-chain",func(p *indexerapi.StakeActivityPage){p.Records[1].ChainID=1}},
	}
	for _,tc:=range cases{
		t.Run(tc.name,func(t *testing.T){
			page:=validStakePage420();tc.mutate(&page)
			idx:=&stakeCapableFake{fakeIndexer:&fakeIndexer{},page:page}
			svc,_:=New(idx,420,time.Minute)
			if _,err:=svc.StakeActivity(context.Background(),"","",50);err==nil{t.Fatal("expected fail-closed rejection")}
		})
	}
}

func TestStakeActivityViewRejectsFilterLeakage(t *testing.T) {
	page:=validStakePage420()
	page.ValidatorID="0x"+strings.Repeat("b",64)
	idx:=&stakeCapableFake{fakeIndexer:&fakeIndexer{},page:page}
	svc,_:=New(idx,420,time.Minute)
	if _,err:=svc.StakeActivity(context.Background(),page.ValidatorID,"",50);err==nil{t.Fatal("validator filter leakage accepted")}

	page=validStakePage420()
	page.Address="0x2222222222222222222222222222222222222222"
	idx=&stakeCapableFake{fakeIndexer:&fakeIndexer{},page:page}
	svc,_=New(idx,420,time.Minute)
	if _,err:=svc.StakeActivity(context.Background(),"",page.Address,50);err==nil{t.Fatal("address filter leakage accepted")}
}
