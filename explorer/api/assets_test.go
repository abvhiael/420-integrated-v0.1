package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

func (f *fakeIndexer) AssetTransfers(context.Context,string,string,uint32)(indexerapi.AssetTransferPage,error){
	addr := "0x1111111111111111111111111111111111111111"
	return indexerapi.AssetTransferPage{Meta:indexerapi.PageMeta{ChainID:420,SnapshotHeight:12,SnapshotHash:"0x12"},AssetKey:"native:420",Address:addr,Transfers:[]model.AssetTransferRecord{{ChainID:420,BlockNumber:12,BlockHash:"0x12",TransactionHash:"0xtx",LogIndex:-1,AssetKey:"native:420",AssetKind:"native",From:addr,To:"0x2222222222222222222222222222222222222222",Amount:"420"}}},nil
}

func TestAssetActivityRoute(t *testing.T){
	s:=newTestServer(t,&fakeIndexer{})
	rr:=httptest.NewRecorder()
	req:=httptest.NewRequest(http.MethodGet,"/v1/assets/activity?assetKey=native%3A420&address=0x1111111111111111111111111111111111111111&limit=25",nil)
	s.Handler().ServeHTTP(rr,req)
	if rr.Code!=http.StatusOK{t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String())}
	var got explorerservice.AssetActivityView
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.TransferCount!=1||got.AssetKey!="native:420"||got.Transfers[0].Amount!="420"{t.Fatalf("unexpected activity: %+v",got)}
}

func TestAssetActivityRouteRejectsInvalidAddress(t *testing.T){
	s:=newTestServer(t,&fakeIndexer{})
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/assets/activity?address=0xnope",nil))
	if rr.Code!=http.StatusBadRequest{t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String())}
}
