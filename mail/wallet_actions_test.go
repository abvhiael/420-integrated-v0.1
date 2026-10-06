package mail

import (
	"context"
	"errors"
	"testing"
	"time"
)

type walletActionAuthorityStub struct {
	handoff WalletHandoff
	verify  WalletVerification
	err     error
	calls   []string
}

func (s *walletActionAuthorityStub) PrepareWalletAction(context.Context, string, WalletActionRequest) (WalletHandoff, error) {
	s.calls = append(s.calls, "prepare")
	return s.handoff, s.err
}
func (s *walletActionAuthorityStub) VerifyWalletEvidence(context.Context, string, WalletVerificationRequest) (WalletVerification, error) {
	s.calls = append(s.calls, "verify")
	return s.verify, s.err
}

func walletTestNow() time.Time {
	return time.Unix(1700000000, 0).UTC()
}

func validTransactionRequest() WalletActionRequest {
	return WalletActionRequest{
		Kind: WalletActionTransaction, ChainID: 420, Account: "0x1111111111111111111111111111111111111111",
		Target: "0x2222222222222222222222222222222222222222", ValueWei: "0", Calldata: "0x1234",
		Explanation: "Send the reviewed 420 Integrated transaction", ExpiresAt: walletTestNow().Add(5 * time.Minute),
	}
}

func validTransactionHandoff(req WalletActionRequest) WalletHandoff {
	return WalletHandoff{
		ID: "handoff-1", Kind: req.Kind, Identity: "alice.420", ChainID: req.ChainID, Account: req.Account,
		Target: req.Target, ValueWei: req.ValueWei, Calldata: req.Calldata, Explanation: req.Explanation,
		ExpiresAt: req.ExpiresAt, AuthorizationEpoch: 7, NonCustodial: true, RequiresApproval: true,
	}
}

func validSignatureRequest() WalletActionRequest {
	return WalletActionRequest{
		Kind: WalletActionMessageSignature, ChainID: 420, Account: "0x1111111111111111111111111111111111111111",
		PayloadDigest: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Explanation: "Verify account control for this Mail action", ExpiresAt: walletTestNow().Add(5 * time.Minute),
	}
}

func TestWalletActionServicePreparesBoundedTransactionAndSignatureHandoffs(t *testing.T) {
	for _, req := range []WalletActionRequest{validTransactionRequest(), validSignatureRequest()} {
		authority := &walletActionAuthorityStub{}
		authority.handoff = validTransactionHandoff(req)
		if req.Kind == WalletActionMessageSignature {
			authority.handoff.Target = ""
			authority.handoff.ValueWei = ""
			authority.handoff.Calldata = ""
			authority.handoff.PayloadDigest = req.PayloadDigest
		}
		svc := NewWalletActionService(authority)
		svc.Now = walletTestNow
		got, err := svc.Prepare(context.Background(), "alice.420", req)
		if err != nil {
			t.Fatal(err)
		}
		if got.Identity != "alice.420" || !got.NonCustodial || !got.RequiresApproval {
			t.Fatalf("unexpected handoff: %+v", got)
		}
		if len(authority.calls) != 1 || authority.calls[0] != "prepare" {
			t.Fatalf("wrong authority calls: %+v", authority.calls)
		}
	}
}

func TestWalletActionServiceRejectsMalformedOrOverbroadIntent(t *testing.T) {
	base := validTransactionRequest()
	cases := []func(*WalletActionRequest){
		func(r *WalletActionRequest) { r.ChainID = 0 },
		func(r *WalletActionRequest) { r.Account = "bad" },
		func(r *WalletActionRequest) { r.Target = "bad" },
		func(r *WalletActionRequest) { r.ValueWei = "-1" },
		func(r *WalletActionRequest) { r.ValueWei = "00" },
		func(r *WalletActionRequest) { r.Calldata = "0x123" },
		func(r *WalletActionRequest) { r.ExpiresAt = walletTestNow() },
		func(r *WalletActionRequest) { r.PayloadDigest = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
	}
	for _, mutate := range cases {
		req := base
		mutate(&req)
		authority := &walletActionAuthorityStub{}
		svc := NewWalletActionService(authority)
		svc.Now = walletTestNow
		if _, err := svc.Prepare(context.Background(), "alice.420", req); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid transaction accepted: %+v err=%v", req, err)
		}
		if len(authority.calls) != 0 {
			t.Fatal("invalid request reached authority")
		}
	}
}

func TestWalletActionServiceRejectsMutatedOrCustodialHandoff(t *testing.T) {
	req := validTransactionRequest()
	cases := []func(*WalletHandoff){
		func(h *WalletHandoff) { h.Identity = "mallory.420" },
		func(h *WalletHandoff) { h.ChainID = 1 },
		func(h *WalletHandoff) { h.Target = "0x3333333333333333333333333333333333333333" },
		func(h *WalletHandoff) { h.ValueWei = "1" },
		func(h *WalletHandoff) { h.Calldata = "0xbeef" },
		func(h *WalletHandoff) { h.NonCustodial = false },
		func(h *WalletHandoff) { h.RequiresApproval = false },
	}
	for _, mutate := range cases {
		h := validTransactionHandoff(req)
		mutate(&h)
		authority := &walletActionAuthorityStub{handoff: h}
		svc := NewWalletActionService(authority)
		svc.Now = walletTestNow
		if _, err := svc.Prepare(context.Background(), "alice.420", req); !errors.Is(err, ErrWalletInvalidResult) {
			t.Fatalf("mutated handoff accepted: %+v err=%v", h, err)
		}
	}
}

func TestWalletActionServiceCanonicalVerificationHandoffs(t *testing.T) {
	txReq := WalletVerificationRequest{Kind: WalletVerifyTransaction, HandoffID: "handoff-1", Evidence: "opaque-rpc-evidence"}
	txOut := WalletVerification{
		HandoffID: "handoff-1", Kind: WalletVerifyTransaction, Identity: "alice.420", ChainID: 420,
		Account: "0x1111111111111111111111111111111111111111", Verified: true, Canonical: true,
		Finalized: true, TxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		VerifiedAt: walletTestNow(), NonCustodial: true,
	}
	authority := &walletActionAuthorityStub{verify: txOut}
	svc := NewWalletActionService(authority)
	got, err := svc.Verify(context.Background(), "alice.420", txReq)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Verified || !got.Canonical || !got.Finalized {
		t.Fatalf("unexpected verification: %+v", got)
	}

	sigReq := WalletVerificationRequest{Kind: WalletVerifySignature, HandoffID: "handoff-2", Evidence: "opaque-signature-proof"}
	sigOut := WalletVerification{
		HandoffID: "handoff-2", Kind: WalletVerifySignature, Identity: "alice.420",
		Account: "0x1111111111111111111111111111111111111111", Verified: true, Canonical: true,
		VerifiedAt: walletTestNow(), NonCustodial: true,
	}
	authority = &walletActionAuthorityStub{verify: sigOut}
	svc = NewWalletActionService(authority)
	if _, err := svc.Verify(context.Background(), "alice.420", sigReq); err != nil {
		t.Fatal(err)
	}
}

func TestWalletActionServiceRejectsNonCanonicalVerification(t *testing.T) {
	req := WalletVerificationRequest{Kind: WalletVerifyTransaction, HandoffID: "handoff-1", Evidence: "evidence"}
	base := WalletVerification{
		HandoffID: "handoff-1", Kind: WalletVerifyTransaction, Identity: "alice.420", ChainID: 420,
		Account: "0x1111111111111111111111111111111111111111", Verified: true, Canonical: true,
		TxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		VerifiedAt: walletTestNow(), NonCustodial: true,
	}
	for _, mutate := range []func(*WalletVerification){
		func(v *WalletVerification) { v.Identity = "mallory.420" },
		func(v *WalletVerification) { v.HandoffID = "other" },
		func(v *WalletVerification) { v.Verified = false },
		func(v *WalletVerification) { v.Canonical = false },
		func(v *WalletVerification) { v.NonCustodial = false },
		func(v *WalletVerification) { v.ChainID = 0 },
		func(v *WalletVerification) { v.TxHash = "bad" },
	} {
		out := base
		mutate(&out)
		authority := &walletActionAuthorityStub{verify: out}
		svc := NewWalletActionService(authority)
		if _, err := svc.Verify(context.Background(), "alice.420", req); !errors.Is(err, ErrWalletInvalidResult) {
			t.Fatalf("invalid verification accepted: %+v err=%v", out, err)
		}
	}
}

func TestWalletActionServiceDependencyFailureHasNoFallback(t *testing.T) {
	dep := errors.New("wallet unavailable")
	authority := &walletActionAuthorityStub{err: dep}
	svc := NewWalletActionService(authority)
	svc.Now = walletTestNow
	if _, err := svc.Prepare(context.Background(), "alice.420", validTransactionRequest()); !errors.Is(err, dep) {
		t.Fatalf("dependency failure lost: %v", err)
	}
}
