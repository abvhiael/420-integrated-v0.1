package service

import (
	"context"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

type assetCapableFake struct {
	*fakeIndexer
	page indexerapi.AssetTransferPage
}
func (f *assetCapableFake) AssetTransfers(context.Context,string,string,uint32)(indexerapi.AssetTransferPage,error){return f.page,nil}

func TestAssetActivityValidatesSnapshotAndFilters(t *testing.T){
	addr := "0x1111111111111111111111111111111111111111"
	idx := &assetCapableFake{fakeIndexer:&fakeIndexer{},page:indexerapi.AssetTransferPage{
		Meta:indexerapi.PageMeta{ChainID:420,SnapshotHeight:12,SnapshotHash:"0x12"},AssetKey:"native:420",Address:addr,
		Transfers:[]model.AssetTransferRecord{{ChainID:420,BlockNumber:12,BlockHash:"0x12",TransactionHash:"0xtx",LogIndex:-1,AssetKey:"native:420",AssetKind:"native",From:addr,To:"0x2222222222222222222222222222222222222222",Amount:"420"}},
	}}
	svc,err:=New(idx,420,time.Minute);if err!=nil{t.Fatal(err)}
	view,err:=svc.AssetActivity(context.Background(),"native:420",addr,50);if err!=nil{t.Fatal(err)}
	if view.TransferCount!=1||view.Meta.SnapshotHeight!=12||view.Transfers[0].Amount!="420"{t.Fatalf("unexpected asset activity: %+v",view)}
	idx.page.Transfers[0].BlockNumber=13
	if _,err:=svc.AssetActivity(context.Background(),"native:420",addr,50);err==nil{t.Fatal("expected beyond-snapshot transfer rejection")}
}

func TestAssetActivityRejectsUnrelatedAddress(t *testing.T){
	addr := "0x1111111111111111111111111111111111111111"
	idx:=&assetCapableFake{fakeIndexer:&fakeIndexer{},page:indexerapi.AssetTransferPage{Meta:indexerapi.PageMeta{ChainID:420,SnapshotHeight:12},Address:addr,Transfers:[]model.AssetTransferRecord{{ChainID:420,BlockNumber:12,TransactionHash:"0xtx",LogIndex:-1,AssetKey:"native:420",AssetKind:"native",From:"0x2222222222222222222222222222222222222222",To:"0x3333333333333333333333333333333333333333",Amount:"1"}}}}
	svc,_:=New(idx,420,time.Minute)
	if _,err:=svc.AssetActivity(context.Background(),"",addr,50);err==nil{t.Fatal("expected unrelated address rejection")}
}
