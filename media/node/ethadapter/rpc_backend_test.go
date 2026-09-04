package ethadapter

import (
	"context"
	"encoding/hex"
	"errors"
	"path/filepath"
	"testing"
)

type fakeRPC struct {
	latest string
	logs   []rpcLog
	call   string
	err    error
}
func (f *fakeRPC) Call(_ context.Context, method string, _ any, result any) error {
	if f.err != nil { return f.err }
	switch method {
	case "eth_blockNumber": *(result.(*string)) = f.latest
	case "eth_getLogs": *(result.(*[]rpcLog)) = append([]rpcLog(nil), f.logs...)
	case "eth_call": *(result.(*string)) = f.call
	default: return errors.New("unexpected method")
	}
	return nil
}

type fakeSigner struct { to string; data []byte; err error }
func (s *fakeSigner) SendTransaction(_ context.Context, to string, data []byte) (string, error) { s.to = to; s.data = append([]byte(nil), data...); return "0xtx", s.err }

type memCursor struct { block uint64; saves int }
func (c *memCursor) Load() (uint64, error) { return c.block, nil }
func (c *memCursor) Save(v uint64) error { c.block = v; c.saves++; return nil }

func testABI() ABIConfig {
	return ABIConfig{JobsSelector:[4]byte{1,2,3,4}, AcceptSelector:[4]byte{5,6,7,8}, MarkRunningSelector:[4]byte{9,10,11,12}, CommitResultSelector:[4]byte{13,14,15,16}, JobCreatedTopic:"0x"+repeatHex("11", 32)}
}
func repeatHex(v string, n int) string { out := ""; for i:=0;i<n;i++ { out += v }; return out }

func encodeTestJob(status uint8) string {
	words := make([]byte, 13*32)
	words[31] = 0x12
	words[32+31] = 0x21
	words[2*32+31] = 0x22
	words[3*32+31] = 0x23
	words[4*32+31] = 0x24
	words[5*32+31] = 0x25
	words[7*32+31] = 0x27
	words[9*32+31] = 42
	words[10*32+31] = 40
	words[11*32+31] = 99
	words[12*32+31] = status
	return "0x"+hex.EncodeToString(words)
}

func TestRPCBackendDiscoversCreatedJobAndAdvancesCursor(t *testing.T) {
	id := b32(7)
	rpc := &fakeRPC{latest:"0x64", logs:[]rpcLog{{BlockNumber:"0x64", Topics:[]string{testABI().JobCreatedTopic, "0x"+hex.EncodeToString(id[:])}}}, call:encodeTestJob(1)}
	cursor := &memCursor{block:90}
	backend, err := NewRPCBackend(rpc, &fakeSigner{}, cursor, "0x"+repeatHex("22",20), b32(9), testABI(), 1)
	if err != nil { t.Fatal(err) }
	jobs, err := backend.ListPendingJobs(context.Background())
	if err != nil { t.Fatal(err) }
	if len(jobs) != 1 || jobs[0].ID != id || jobs[0].Status != 1 { t.Fatalf("jobs=%+v", jobs) }
	if cursor.block != 100 || cursor.saves != 1 { t.Fatalf("cursor=%d saves=%d", cursor.block, cursor.saves) }
}

func TestRPCBackendSignerBoundaryBuildsAcceptCalldata(t *testing.T) {
	signer := &fakeSigner{}
	backend, err := NewRPCBackend(&fakeRPC{}, signer, &memCursor{}, "0x"+repeatHex("22",20), b32(9), testABI(), 1)
	if err != nil { t.Fatal(err) }
	id := b32(3)
	if err := backend.AcceptJob(context.Background(), id); err != nil { t.Fatal(err) }
	if len(signer.data) != 68 { t.Fatalf("calldata len=%d", len(signer.data)) }
	if signer.data[0] != 5 || signer.data[35] != 3 || signer.data[67] != 9 { t.Fatalf("unexpected calldata %x", signer.data) }
}

func TestDecodeJobFailsClosedOnUintOverflow(t *testing.T) {
	raw, _ := decodeHex(encodeTestJob(3))
	raw[9*32] = 1
	_, err := decodeJob(b32(1), "0x"+hex.EncodeToString(raw))
	if !errors.Is(err, ErrValueOverflow) { t.Fatalf("err=%v", err) }
}

func TestFileCursorPersistsAtomically(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "cursor.json")
	c, err := NewFileCursor(path); if err != nil { t.Fatal(err) }
	if err := c.Save(420); err != nil { t.Fatal(err) }
	got, err := c.Load(); if err != nil { t.Fatal(err) }
	if got != 420 { t.Fatalf("got=%d", got) }
}

func TestRPCBackendRejectsIncompleteABI(t *testing.T) {
	_, err := NewRPCBackend(&fakeRPC{}, &fakeSigner{}, &memCursor{}, "0x"+repeatHex("22",20), b32(9), ABIConfig{}, 1)
	if err == nil { t.Fatal("expected error") }
}
