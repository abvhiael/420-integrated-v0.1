package mail

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
)

const (
	MaxWalletCalldataBytes     = 64 << 10
	MaxWalletVerificationBytes = 64 << 10
	MaxWalletExplanationBytes  = 512
	MaxWalletDigestBytes       = 256
)

type WalletActionKind string
type WalletVerificationKind string

const (
	WalletActionTransaction      WalletActionKind = "TRANSACTION"
	WalletActionMessageSignature WalletActionKind = "MESSAGE_SIGNATURE"

	WalletVerifyTransaction WalletVerificationKind = "TRANSACTION"
	WalletVerifySignature   WalletVerificationKind = "SIGNATURE"
)

var ErrWalletInvalidResult = errors.New("mail: invalid wallet authority result")

type WalletActionRequest struct {
	Kind          WalletActionKind `json:"kind"`
	ChainID       uint64           `json:"chain_id"`
	Account       string           `json:"account"`
	Target        string           `json:"target,omitempty"`
	ValueWei      string           `json:"value_wei,omitempty"`
	Calldata      string           `json:"calldata,omitempty"`
	PayloadDigest string           `json:"payload_digest,omitempty"`
	Explanation   string           `json:"explanation"`
	ExpiresAt     time.Time        `json:"expires_at"`
}

type WalletHandoff struct {
	ID                 string           `json:"id"`
	Kind               WalletActionKind `json:"kind"`
	Identity           string           `json:"identity"`
	ChainID            uint64           `json:"chain_id"`
	Account            string           `json:"account"`
	Target             string           `json:"target,omitempty"`
	ValueWei           string           `json:"value_wei,omitempty"`
	Calldata           string           `json:"calldata,omitempty"`
	PayloadDigest      string           `json:"payload_digest,omitempty"`
	Explanation        string           `json:"explanation"`
	ExpiresAt          time.Time        `json:"expires_at"`
	AuthorizationEpoch uint64           `json:"authorization_epoch"`
	NonCustodial       bool             `json:"non_custodial"`
	RequiresApproval   bool             `json:"requires_wallet_approval"`
}

type WalletVerificationRequest struct {
	Kind      WalletVerificationKind `json:"kind"`
	HandoffID string                 `json:"handoff_id"`
	Evidence  string                 `json:"evidence"`
}

type WalletVerification struct {
	HandoffID    string                 `json:"handoff_id"`
	Kind         WalletVerificationKind `json:"kind"`
	Identity     string                 `json:"identity"`
	ChainID      uint64                 `json:"chain_id,omitempty"`
	Account      string                 `json:"account"`
	Verified     bool                   `json:"verified"`
	Canonical    bool                   `json:"canonical"`
	Finalized    bool                   `json:"finalized,omitempty"`
	TxHash       string                 `json:"tx_hash,omitempty"`
	VerifiedAt   time.Time              `json:"verified_at"`
	NonCustodial bool                   `json:"non_custodial"`
}

type WalletActionAuthority interface {
	PrepareWalletAction(context.Context, string, WalletActionRequest) (WalletHandoff, error)
	VerifyWalletEvidence(context.Context, string, WalletVerificationRequest) (WalletVerification, error)
}

type WalletActionService struct {
	Authority WalletActionAuthority
	Now       func() time.Time
}

func NewWalletActionService(authority WalletActionAuthority) *WalletActionService {
	return &WalletActionService{Authority: authority, Now: func() time.Time { return time.Now().UTC() }}
}

func (s *WalletActionService) Prepare(ctx context.Context, actor string, req WalletActionRequest) (WalletHandoff, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return WalletHandoff{}, ErrUnauthorized
	}
	req = normalizeWalletActionRequest(req)
	now := time.Now().UTC()
	if s != nil && s.Now != nil {
		now = s.Now().UTC()
	}
	if err := validateWalletActionRequest(req, now); err != nil {
		return WalletHandoff{}, err
	}
	if s == nil || s.Authority == nil {
		return WalletHandoff{}, errors.New("mail: wallet action authority unavailable")
	}
	out, err := s.Authority.PrepareWalletAction(ctx, actor, req)
	if err != nil {
		return WalletHandoff{}, fmt.Errorf("mail: wallet action authority: %w", err)
	}
	out = normalizeWalletHandoff(out)
	if err := validateWalletHandoff(actor, req, out, now); err != nil {
		return WalletHandoff{}, err
	}
	return out, nil
}

func (s *WalletActionService) Verify(ctx context.Context, actor string, req WalletVerificationRequest) (WalletVerification, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return WalletVerification{}, ErrUnauthorized
	}
	req.Kind = WalletVerificationKind(strings.TrimSpace(string(req.Kind)))
	req.HandoffID = strings.TrimSpace(req.HandoffID)
	req.Evidence = strings.TrimSpace(req.Evidence)
	if (req.Kind != WalletVerifyTransaction && req.Kind != WalletVerifySignature) || req.HandoffID == "" || req.Evidence == "" || len([]byte(req.HandoffID)) > 256 || len([]byte(req.Evidence)) > MaxWalletVerificationBytes {
		return WalletVerification{}, ErrInvalidInput
	}
	if s == nil || s.Authority == nil {
		return WalletVerification{}, errors.New("mail: wallet action authority unavailable")
	}
	out, err := s.Authority.VerifyWalletEvidence(ctx, actor, req)
	if err != nil {
		return WalletVerification{}, fmt.Errorf("mail: wallet verification authority: %w", err)
	}
	out = normalizeWalletVerification(out)
	if err := validateWalletVerification(actor, req, out); err != nil {
		return WalletVerification{}, err
	}
	return out, nil
}

func normalizeWalletActionRequest(req WalletActionRequest) WalletActionRequest {
	req.Kind = WalletActionKind(strings.TrimSpace(string(req.Kind)))
	req.Account = strings.TrimSpace(req.Account)
	req.Target = strings.TrimSpace(req.Target)
	req.ValueWei = strings.TrimSpace(req.ValueWei)
	req.Calldata = strings.TrimSpace(req.Calldata)
	req.PayloadDigest = strings.TrimSpace(req.PayloadDigest)
	req.Explanation = strings.TrimSpace(req.Explanation)
	return req
}

func validateWalletActionRequest(req WalletActionRequest, now time.Time) error {
	if req.ChainID == 0 || !validWalletAddress(req.Account) || req.Explanation == "" || len([]byte(req.Explanation)) > MaxWalletExplanationBytes || !req.ExpiresAt.After(now) {
		return ErrInvalidInput
	}
	switch req.Kind {
	case WalletActionTransaction:
		if !validWalletAddress(req.Target) || req.PayloadDigest != "" || !validHexBytes(req.Calldata, MaxWalletCalldataBytes) || !validUnsignedDecimal(req.ValueWei) {
			return ErrInvalidInput
		}
	case WalletActionMessageSignature:
		if req.Target != "" || req.ValueWei != "" || req.Calldata != "" || !validDigest(req.PayloadDigest) {
			return ErrInvalidInput
		}
	default:
		return ErrInvalidInput
	}
	return nil
}

func normalizeWalletHandoff(out WalletHandoff) WalletHandoff {
	out.ID = strings.TrimSpace(out.ID)
	out.Kind = WalletActionKind(strings.TrimSpace(string(out.Kind)))
	out.Identity = strings.TrimSpace(out.Identity)
	out.Account = strings.TrimSpace(out.Account)
	out.Target = strings.TrimSpace(out.Target)
	out.ValueWei = strings.TrimSpace(out.ValueWei)
	out.Calldata = strings.TrimSpace(out.Calldata)
	out.PayloadDigest = strings.TrimSpace(out.PayloadDigest)
	out.Explanation = strings.TrimSpace(out.Explanation)
	return out
}

func validateWalletHandoff(actor string, req WalletActionRequest, out WalletHandoff, now time.Time) error {
	if out.ID == "" || out.Identity != actor || out.Kind != req.Kind || out.ChainID != req.ChainID || !sameAddress(out.Account, req.Account) || out.Explanation != req.Explanation || !out.ExpiresAt.Equal(req.ExpiresAt) || !out.ExpiresAt.After(now) || !out.NonCustodial || !out.RequiresApproval {
		return ErrWalletInvalidResult
	}
	switch req.Kind {
	case WalletActionTransaction:
		if !sameAddress(out.Target, req.Target) || out.ValueWei != req.ValueWei || !strings.EqualFold(out.Calldata, req.Calldata) || out.PayloadDigest != "" {
			return ErrWalletInvalidResult
		}
	case WalletActionMessageSignature:
		if out.Target != "" || out.ValueWei != "" || out.Calldata != "" || !strings.EqualFold(out.PayloadDigest, req.PayloadDigest) {
			return ErrWalletInvalidResult
		}
	default:
		return ErrWalletInvalidResult
	}
	return nil
}

func normalizeWalletVerification(out WalletVerification) WalletVerification {
	out.HandoffID = strings.TrimSpace(out.HandoffID)
	out.Kind = WalletVerificationKind(strings.TrimSpace(string(out.Kind)))
	out.Identity = strings.TrimSpace(out.Identity)
	out.Account = strings.TrimSpace(out.Account)
	out.TxHash = strings.TrimSpace(out.TxHash)
	return out
}

func validateWalletVerification(actor string, req WalletVerificationRequest, out WalletVerification) error {
	if out.HandoffID != req.HandoffID || out.Kind != req.Kind || out.Identity != actor || !validWalletAddress(out.Account) || out.VerifiedAt.IsZero() || !out.NonCustodial {
		return ErrWalletInvalidResult
	}
	if !out.Verified || !out.Canonical {
		return ErrWalletInvalidResult
	}
	switch req.Kind {
	case WalletVerifyTransaction:
		if out.ChainID == 0 || !validHash(out.TxHash) {
			return ErrWalletInvalidResult
		}
	case WalletVerifySignature:
		if out.TxHash != "" || out.Finalized {
			return ErrWalletInvalidResult
		}
	default:
		return ErrWalletInvalidResult
	}
	return nil
}

func validUnsignedDecimal(value string) bool {
	if value == "" {
		return false
	}
	n, ok := new(big.Int).SetString(value, 10)
	return ok && n.Sign() >= 0 && n.String() == value
}

func validHexBytes(value string, maxBytes int) bool {
	if len(value) < 2 || !strings.HasPrefix(value, "0x") || (len(value)-2)%2 != 0 || (len(value)-2)/2 > maxBytes {
		return false
	}
	for _, r := range value[2:] {
		if !isHexRune(r) {
			return false
		}
	}
	return true
}

func validDigest(value string) bool {
	return validHash(value) && len(value) == 66
}

func validHash(value string) bool {
	return len(value) == 66 && strings.HasPrefix(value, "0x") && allHex(value[2:])
}

func allHex(value string) bool {
	for _, r := range value {
		if !isHexRune(r) {
			return false
		}
	}
	return true
}

func isHexRune(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func sameAddress(a, b string) bool {
	return validWalletAddress(a) && validWalletAddress(b) && strings.EqualFold(a, b)
}
