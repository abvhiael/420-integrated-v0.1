package service

import (
	"context"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestIDAudit6ExplorerPreservesIdentityRawEventProvenanceWithoutClaimingPayload(t *testing.T) {
	topic0 := "0x" + strings.Repeat("11", 32)
	profileTopic := "0x" + strings.Repeat("22", 32)
	metadataCommitment := "0x" + strings.Repeat("33", 32)

	idx := &fakeIndexer{
		health: indexerapi.HealthResponse{Health:model.Health{
			ChainID:420, IndexedHeight:77, SafeHeight:76, FinalizedHeight:75,
			State:"HEALTHY", LastIngestAt:time.Now(),
		}},
		tx:model.TransactionRecord{
			ChainID:420, BlockNumber:77, BlockHash:"0xblock", Hash:"0xtx", Index:1,
			From:"0x1111111111111111111111111111111111111111",
			To:"0x0000000000000000000000000000000000000436",
			ValueWei:"0", Input:"0x",
		},
		receipt:model.ReceiptRecord{
			ChainID:420, BlockNumber:77, BlockHash:"0xblock", TransactionHash:"0xtx",
			TransactionIndex:1, Status:1, GasUsed:1, EffectiveGasPriceWei:"1", ActualFeeWei:"1",
		},
		block:model.BlockRecord{ChainID:420, Number:77, Hash:"0xblock"},
		block:model.BlockRecord{ChainID:420,Number:77,Hash:"0xblock"},\n\t\tlogs:[]model.LogRecord{{
			ChainID:420, BlockNumber:77, BlockHash:"0xblock", TransactionHash:"0xtx",
			TransactionIndex:1, LogIndex:0,
			Address:"0x0000000000000000000000000000000000000436",
			Topics:[]string{topic0, profileTopic},
			Data:metadataCommitment,
			DecoderVersion:"identity420-v3",
		}},
	}

	svc, err := New(idx, 420, time.Minute)
	if err != nil { t.Fatal(err) }
	view, err := svc.TransactionDetail(context.Background(), "0xtx")
	if err != nil { t.Fatal(err) }
	if len(view.Logs) != 1 { t.Fatalf("identity log missing: %+v", view.Logs) }
	log := view.Logs[0]
	if log.Address != "0x0000000000000000000000000000000000000436" ||
		log.Topics[0] != topic0 || log.Topics[1] != profileTopic ||
		log.Data != metadataCommitment || log.DecoderVersion != "identity420-v3" {
		t.Fatalf("identity raw provenance drift: %+v", log)
	}
}

func TestIDAudit6ExplorerRejectsMalformedIdentityCommitmentEncoding(t *testing.T) {
	idx := &fakeIndexer{
		health:indexerapi.HealthResponse{Health:model.Health{
			ChainID:420, IndexedHeight:77, State:"HEALTHY", LastIngestAt:time.Now(),
		}},
		tx:model.TransactionRecord{ChainID:420,BlockNumber:77,BlockHash:"0xblock",Hash:"0xtx",Index:1,From:"0x1111111111111111111111111111111111111111",To:"0x0000000000000000000000000000000000000436",ValueWei:"0",Input:"0x"},
		receipt:model.ReceiptRecord{ChainID:420,BlockNumber:77,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:1,Status:1,GasUsed:0,EffectiveGasPriceWei:"0",ActualFeeWei:"0"},
		logs:[]model.LogRecord{{
			ChainID:420,BlockNumber:77,BlockHash:"0xblock",TransactionHash:"0xtx",
			TransactionIndex:1,LogIndex:0,
			Address:"0x0000000000000000000000000000000000000436",
			Topics:[]string{"0x"+strings.Repeat("11",32)},
			Data:"metadata://private-profile-payload",
		}},
	}
	svc, _ := New(idx,420,time.Minute)
	if _, err := svc.TransactionDetail(context.Background(),"0xtx"); err == nil || !strings.Contains(err.Error(),"log data") {
		t.Fatalf("expected fail-closed malformed Identity payload, got %v", err)
	}
}
