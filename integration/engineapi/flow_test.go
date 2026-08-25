package engineapi

import (
	"context"
	"net/http/httptest"
	"testing"

	eng "github.com/420integrated/420-integrated/consensus/engine"
)

func TestPayloadFlow(t *testing.T) {
	srv := httptest.NewServer(Mock{PayloadID: "0x0000000000000001"}.Handler())
	defer srv.Close()

	secret := []byte("0123456789abcdef0123456789abcdef")
	c, err := eng.NewClient(srv.URL, secret)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	caps, err := c.ExchangeCapabilities(ctx, []string{
		"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3",
	})
	if err != nil || len(caps) != 3 {
		t.Fatalf("caps=%v err=%v", caps, err)
	}

	state := eng.ForkchoiceStateV1{
		HeadBlockHash:      "0x0000000000000000000000000000000000000000000000000000000000000001",
		SafeBlockHash:      "0x0000000000000000000000000000000000000000000000000000000000000001",
		FinalizedBlockHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
	}
	attrs := &eng.PayloadAttributesV3{
		Timestamp:             "0x1",
		PrevRandao:            "0x0000000000000000000000000000000000000000000000000000000000000420",
		SuggestedFeeRecipient: "0x0000000000000000000000000000000000000420",
		Withdrawals:           []any{},
		ParentBeaconBlockRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
	}
	fcu, err := c.ForkchoiceUpdatedV3(ctx, state, attrs)
	if err != nil {
		t.Fatal(err)
	}
	if fcu.PayloadID == nil {
		t.Fatal("missing payload id")
	}

	payload, err := c.GetPayloadV3(ctx, *fcu.PayloadID)
	if err != nil {
		t.Fatal(err)
	}
	if payload.ExecutionPayload.BlockNumber != "0x1" {
		t.Fatalf("block number=%s", payload.ExecutionPayload.BlockNumber)
	}

	status, err := c.NewPayloadV3(
	ctx,
	payload.ExecutionPayload,
	[]eng.Hash32{},
	attrs.ParentBeaconBlockRoot,
)
	if err != nil {
		t.Fatal(err)
	}
	if status.Status != "VALID" {
		t.Fatalf("status=%s", status.Status)
	}
}
