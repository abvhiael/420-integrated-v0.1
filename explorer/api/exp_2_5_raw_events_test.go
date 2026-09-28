package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

func TestEXP25TransactionAndBlockAPISerializeRawEventPayloads(t *testing.T){
	topic0:="0x"+strings.Repeat("11",32)
	topic1:="0x"+strings.Repeat("22",32)
	idx:=&fakeIndexer{
		health:indexerapi.HealthResponse{Health:model.Health{ChainID:420,IndexedHeight:9,State:"HEALTHY",LastIngestAt:time.Now()}},
		tx:model.TransactionRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",Hash:"0xtx",Index:2,From:"0x1111111111111111111111111111111111111111",To:"0x2222222222222222222222222222222222222222",ValueWei:"420",Input:"0xdeadbeef"},
		receipt:model.ReceiptRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,Status:0,GasUsed:21000,EffectiveGasPriceWei:"1",ActualFeeWei:"21000"},
		block:model.BlockRecord{ChainID:420,Number:9,Hash:"0xblock",Finality:model.FinalityFinalized,Producer:&model.BlockProducer{ConsensusSlot:9,ProducerSeat:1,ConsensusBlockRoot:"0xc",Certified:true}},
		logs:[]model.LogRecord{{ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,LogIndex:0,Address:"0x3333333333333333333333333333333333333333",Topics:[]string{topic0,topic1},Data:"0x010203"}},
	}
	s:=newTestServer(t,idx)

	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/transactions/0xtx",nil))
	if rr.Code!=http.StatusOK{t.Fatalf("tx status=%d body=%s",rr.Code,rr.Body.String())}
	var tx explorerservice.TransactionDetailView
	if err:=json.Unmarshal(rr.Body.Bytes(),&tx);err!=nil{t.Fatal(err)}
	if tx.Transaction.Input!="0xdeadbeef" || tx.Transaction.ValueWei!="420" || tx.Receipt.StatusLabel!="REVERTED" ||
		len(tx.Logs)!=1 || len(tx.Logs[0].Topics)!=2 || tx.Logs[0].Data!="0x010203"{
		t.Fatalf("unexpected tx detail: %+v",tx)
	}

	rr=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/blocks/9",nil))
	if rr.Code!=http.StatusOK{t.Fatalf("block status=%d body=%s",rr.Code,rr.Body.String())}
	var block explorerservice.BlockDetailView
	if err:=json.Unmarshal(rr.Body.Bytes(),&block);err!=nil{t.Fatal(err)}
	if block.LogCount!=1 || block.Logs[0].Topics[1]!=topic1 || block.Logs[0].Data!="0x010203"{
		t.Fatalf("unexpected block events: %+v",block.Logs)
	}
}

func TestEXP25APIFailsClosedOnMalformedRawEvent(t *testing.T){
	idx:=&fakeIndexer{
		health:indexerapi.HealthResponse{Health:model.Health{ChainID:420,IndexedHeight:9,State:"HEALTHY",LastIngestAt:time.Now()}},
		tx:model.TransactionRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",Hash:"0xtx",Index:2,Input:"0x"},
		receipt:model.ReceiptRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,Status:1,EffectiveGasPriceWei:"0",ActualFeeWei:"0"},
		block:model.BlockRecord{ChainID:420,Number:9,Hash:"0xblock",Producer:&model.BlockProducer{ConsensusSlot:9,ProducerSeat:1,ConsensusBlockRoot:"0xc",Certified:true}},
		logs:[]model.LogRecord{{ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,Address:"0x3333333333333333333333333333333333333333",Topics:[]string{"0x1234"},Data:"0x"}},
	}
	s:=newTestServer(t,idx)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/transactions/0xtx",nil))
	if rr.Code==http.StatusOK{t.Fatalf("malformed raw event unexpectedly succeeded: %s",rr.Body.String())}
	if !strings.Contains(rr.Body.String(),"log topic"){t.Fatalf("unexpected body: %s",rr.Body.String())}
}
