package authority

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
)

type rpcFake struct {
	responses map[string]string
	err       error
	calls     []string
}

func (f *rpcFake) Call(_ context.Context, method string, params any, result any) error {
	if f.err != nil {
		return f.err
	}
	if method != "eth_call" {
		return errors.New("unexpected method")
	}
	args := params.([]any)
	call := args[0].(map[string]any)
	to := strings.ToLower(call["to"].(string))
	data := strings.ToLower(call["data"].(string))
	f.calls = append(f.calls, to+"|"+data[:10])
	key := to + "|" + data[:10]
	raw, ok := f.responses[key]
	if !ok {
		return errors.New("missing response")
	}
	*result.(*string) = raw
	return nil
}

func addressWord(address string) [32]byte {
	var out [32]byte
	b, _ := hex.DecodeString(address[2:])
	copy(out[12:], b)
	return out
}

func uintWord(v byte) [32]byte {
	var out [32]byte
	out[31] = v
	return out
}

func encodeWords(words ...[32]byte) string {
	raw := make([]byte, 0, len(words)*32)
	for _, word := range words {
		raw = append(raw, word[:]...)
	}
	return "0x" + hex.EncodeToString(raw)
}

func TestEthereumIdentityReaderReadsOptionalCanonicalProfile(t *testing.T) {
	const identity = "0x3333333333333333333333333333333333333333"
	const selector = "0x11111111"
	profileID := word(7)
	rpc := &rpcFake{responses: map[string]string{
		identity + "|" + selector: encodeWords(
			addressWord(walletA), addressWord("0x0000000000000000000000000000000000000001"),
			word(1), word(2), uintWord(1), uintWord(2), uintWord(1),
		),
	}}
	reader, err := NewEthereumIdentityReader(rpc, identity, selector)
	if err != nil {
		t.Fatal(err)
	}
	profile, err := reader.Profile(context.Background(), profileID)
	if err != nil {
		t.Fatal(err)
	}
	if profile.Controller != walletA || !profile.Active {
		t.Fatalf("profile=%+v", profile)
	}
}

func TestEthereumRightsReaderChecksSubjectRightAndExactLicenseUse(t *testing.T) {
	const assets = "0x4444444444444444444444444444444444444444"
	const claims = "0x5555555555555555555555555555555555555555"
	const router = "0x6666666666666666666666666666666666666666"
	const subjectSelector = "0xaaaaaaaa"
	const claimSelector = "0xbbbbbbbb"
	const effectiveSelector = "0xcccccccc"
	const canUseSelector = "0xdddddddd"
	subjectID, provenance, rightID := word(1), word(2), word(3)

	rpc := &rpcFake{responses: map[string]string{
		assets + "|" + subjectSelector: encodeWords(
			word(9), addressWord(walletB), word(8), provenance, uintWord(1), uintWord(1),
		),
		claims + "|" + claimSelector: encodeWords(
			subjectID, word(7), addressWord(walletA), word(6), word(5),
			uintWord(1), uintWord(0), uintWord(1), uintWord(1), [32]byte{},
		),
		router + "|" + effectiveSelector: encodeWords(uintWord(1)),
		router + "|" + canUseSelector:    encodeWords(uintWord(1)),
	}}
	reader, err := NewEthereumRightsReader(
		rpc, assets, claims, router,
		subjectSelector, claimSelector, effectiveSelector, canUseSelector,
	)
	if err != nil {
		t.Fatal(err)
	}
	subject, err := reader.Subject(context.Background(), subjectID)
	if err != nil || subject.ProvenanceHash != provenance || subject.Controller != walletB {
		t.Fatalf("subject=%+v err=%v", subject, err)
	}
	right, err := reader.Right(context.Background(), rightID)
	if err != nil || !right.Effective || right.SubjectID != subjectID || right.Holder != walletA {
		t.Fatalf("right=%+v err=%v", right, err)
	}
	allowed, err := reader.CanUse(context.Background(), word(4), walletA, word(5))
	if err != nil || !allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
	}
}

func TestEthereumAuthorityReadersFailClosedOnMalformedOrRPCFailure(t *testing.T) {
	const identity = "0x3333333333333333333333333333333333333333"
	const selector = "0x11111111"
	rpc := &rpcFake{responses: map[string]string{identity + "|" + selector: "0x"}}
	reader, _ := NewEthereumIdentityReader(rpc, identity, selector)
	if _, err := reader.Profile(context.Background(), word(1)); !errors.Is(err, ErrMalformedAuthorityState) {
		t.Fatalf("malformed err=%v", err)
	}
	rpc.err = errors.New("rpc down")
	if _, err := reader.Profile(context.Background(), word(1)); err == nil {
		t.Fatal("expected rpc error")
	}
}
