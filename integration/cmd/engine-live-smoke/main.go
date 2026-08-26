package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	consys "github.com/420integrated/420-integrated/consensus/systemcall"
)

type rpcReq struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params"`
}
type rpcResp struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type ethBlock struct {
	Hash      string `json:"hash"`
	Timestamp string `json:"timestamp"`
}

func ethCall(ctx context.Context, endpoint, method string, params any, out any) error {
	body, _ := json.Marshal(rpcReq{JSONRPC: "2.0", ID: 1, Method: method, Params: params})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(raw))
	}
	var rr rpcResp
	if err := json.Unmarshal(raw, &rr); err != nil {
		return err
	}
	if rr.Error != nil {
		return fmt.Errorf("rpc %d: %s", rr.Error.Code, rr.Error.Message)
	}
	return json.Unmarshal(rr.Result, out)
}

func hexUint64(s string) (uint64, error) {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return 0, nil
	}
	return strconv.ParseUint(s, 16, 64)
}

func parseHash32(s string) ([32]byte, error) {
	var out [32]byte
	s = strings.TrimPrefix(s, "0x")
	if len(s) != 64 {
		return out, fmt.Errorf("expected 32-byte hash, got %d hex chars", len(s))
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return out, err
	}
	copy(out[:], b)
	return out, nil
}

func main() {
	engineEndpoint := flag.String("engine", "http://127.0.0.1:8551", "Engine API endpoint")
	rpcEndpoint := flag.String("rpc", "http://127.0.0.1:8545", "execution JSON-RPC endpoint")
	jwtPath := flag.String("jwt-secret", "./jwt.hex", "Engine API JWT secret")
	feeRecipient := flag.String("fee-recipient", "0x0000000000000000000000000000000000000420", "suggested fee recipient")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	secret, err := eng.LoadJWTSecret(*jwtPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	client, err := eng.NewClient(*engineEndpoint, secret)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}

	required := []string{"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3", "engine420_submitSystemCallsV1"}
	caps, err := client.ExchangeCapabilities(ctx, required)
	if err != nil {
		fmt.Fprintln(os.Stderr, "capabilities:", err)
		os.Exit(3)
	}
	fmt.Printf("ENGINE_CAPABILITIES=%v\n", caps)

	var genesis ethBlock
	if err := ethCall(ctx, *rpcEndpoint, "eth_getBlockByNumber", []any{"0x0", false}, &genesis); err != nil {
		fmt.Fprintln(os.Stderr, "genesis:", err)
		os.Exit(4)
	}
	if genesis.Hash == "" {
		fmt.Fprintln(os.Stderr, "genesis block hash missing")
		os.Exit(4)
	}
	ts, err := hexUint64(genesis.Timestamp)
	if err != nil {
		fmt.Fprintln(os.Stderr, "genesis timestamp:", err)
		os.Exit(4)
	}
	parentArray, err := parseHash32(genesis.Hash)
	if err != nil {
		fmt.Fprintln(os.Stderr, "genesis hash:", err)
		os.Exit(4)
	}

	// 420 protocol rule: consensus data must be staged before payload construction,
	// including blocks with zero system calls. The empty batch still has a canonical root.
	batch := consys.Batch{
		ExecutionBlock: 1,
		ParentHash:     parentArray,
		ChainID:        420,
		Calls:          []consys.Call{},
	}
	if err := batch.Validate(0); err != nil {
		fmt.Fprintln(os.Stderr, "empty system-call batch:", err)
		os.Exit(4)
	}
	root := batch.Root()
	stage := eng.SystemCallBatchV1{
		ExecutionBlock: "0x1",
		ParentHash:     eng.Hash32(genesis.Hash),
		ChainID:        "0x1a4",
		BatchRoot:      eng.Hash32(fmt.Sprintf("0x%x", root[:])),
		Calls:          []eng.SystemCallV1{},
	}
	staged, err := client.SubmitSystemCallsV1(ctx, stage)
	if err != nil {
		fmt.Fprintln(os.Stderr, "submitSystemCallsV1:", err)
		os.Exit(5)
	}
	if staged.Status == "" {
		fmt.Fprintln(os.Stderr, "submitSystemCallsV1: empty status")
		os.Exit(5)
	}
	fmt.Printf("SYSTEM_CALL_BATCH status=%s root=%s\n", staged.Status, staged.BatchRoot)

	head := eng.Hash32(genesis.Hash)
	state := eng.ForkchoiceStateV1{
		HeadBlockHash: head, SafeBlockHash: head, FinalizedBlockHash: head,
	}
	var randao eng.Hash32 = "0x0000000000000000000000000000000000000000000000000000000000000420"
	var parentBeacon eng.Hash32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
	attrs := &eng.PayloadAttributesV3{
		Timestamp:             fmt.Sprintf("0x%x", ts+12),
		PrevRandao:            randao,
		SuggestedFeeRecipient: *feeRecipient,
		Withdrawals:           []any{},
		ParentBeaconBlockRoot: parentBeacon,
	}
	fcu, err := client.ForkchoiceUpdatedV3(ctx, state, attrs)
	if err != nil {
		fmt.Fprintln(os.Stderr, "forkchoiceUpdatedV3:", err)
		os.Exit(5)
	}
	if fcu.PayloadStatus.Status != "VALID" && fcu.PayloadStatus.Status != "SYNCING" {
		fmt.Fprintf(os.Stderr, "unexpected forkchoice status %s\n", fcu.PayloadStatus.Status)
		os.Exit(5)
	}
	if fcu.PayloadID == nil {
		fmt.Fprintln(os.Stderr, "payload ID missing")
		os.Exit(5)
	}

	payload, err := client.GetPayloadV3(ctx, *fcu.PayloadID)
	if err != nil {
		fmt.Fprintln(os.Stderr, "getPayloadV3:", err)
		os.Exit(6)
	}
	fmt.Printf("ENGINE_PAYLOAD block=%s hash=%s txs=%d\n",
		payload.ExecutionPayload.BlockNumber, payload.ExecutionPayload.BlockHash, len(payload.ExecutionPayload.Transactions))

	status, err := client.NewPayloadV3(
		ctx,
		payload.ExecutionPayload,
		[]eng.Hash32{},
		parentBeacon,
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, "newPayloadV3:", err)
		os.Exit(7)
	}
	if status.Status != "VALID" {
		fmt.Fprintf(os.Stderr, "newPayload status=%s\n", status.Status)
		os.Exit(7)
	}

	newState := eng.ForkchoiceStateV1{
		HeadBlockHash:      payload.ExecutionPayload.BlockHash,
		SafeBlockHash:      payload.ExecutionPayload.BlockHash,
		FinalizedBlockHash: head,
	}
	fcu2, err := client.ForkchoiceUpdatedV3(ctx, newState, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, "final forkchoice:", err)
		os.Exit(8)
	}
	if fcu2.PayloadStatus.Status != "VALID" && fcu2.PayloadStatus.Status != "SYNCING" {
		fmt.Fprintf(os.Stderr, "final forkchoice status=%s\n", fcu2.PayloadStatus.Status)
		os.Exit(8)
	}
	fmt.Println("LIVE_ENGINE_PAYLOAD_SMOKE=PASS")
}
