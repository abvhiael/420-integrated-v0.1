package engineapi

import (
	"context"
	"net/http/httptest"
	"testing"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func TestExecutionPayloadWrappedByConsensusBlock(t *testing.T) {
	srv := httptest.NewServer(Mock{PayloadID: "0x0000000000000001"}.Handler())
	defer srv.Close()

	secret := []byte("0123456789abcdef0123456789abcdef")
	c, err := eng.NewClient(srv.URL, secret)
	if err != nil {
		t.Fatal(err)
	}

	var one eng.Hash32 = "0x0000000000000000000000000000000000000000000000000000000000000001"
	state := eng.ForkchoiceStateV1{HeadBlockHash: one, SafeBlockHash: one, FinalizedBlockHash: one}
	attrs := &eng.PayloadAttributesV3{
		Timestamp:             "0x1",
		PrevRandao:            "0x0000000000000000000000000000000000000000000000000000000000000420",
		SuggestedFeeRecipient: "0x0000000000000000000000000000000000000420",
		Withdrawals:           []any{},
		ParentBeaconBlockRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
	}
	fcu, err := c.ForkchoiceUpdatedV3(context.Background(), state, attrs)
	if err != nil {
		t.Fatal(err)
	}
	payload, err := c.GetPayloadV3(context.Background(), *fcu.PayloadID)
	if err != nil {
		t.Fatal(err)
	}

	execRoot, err := ctypes.ParseRoot(string(payload.ExecutionPayload.BlockHash))
	if err != nil {
		t.Fatal(err)
	}
	block := ctypes.ConsensusBlock{
		Slot:                 1,
		ProposerSeat:         0,
		ProposerRank:         0,
		ExecutionPayloadHash: execRoot,
	}
	root := block.HashTreeRoot()
	if root == (ctypes.Root{}) {
		t.Fatal("consensus block root should not be zero")
	}
	if block.ExecutionPayloadHash != execRoot {
		t.Fatal("execution payload hash not bound into consensus block")
	}
}
