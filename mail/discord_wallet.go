package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

const MaxDiscordWalletChallengeTTL = 10 * time.Minute

var ErrDiscordWalletConflict = errors.New("mail: discord wallet verification conflict")

type DiscordWalletChallengeRequest struct {
	ConnectionID string    `json:"connection_id"`
	ChainID      uint64    `json:"chain_id"`
	Account      string    `json:"account"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type DiscordWalletChallenge struct {
	HandoffID      string    `json:"handoff_id"`
	ConnectionID   string    `json:"connection_id"`
	DiscordUserID  string    `json:"discord_user_id"`
	ChainID        uint64    `json:"chain_id"`
	Account        string    `json:"account"`
	PayloadDigest  string    `json:"payload_digest"`
	ExpiresAt      time.Time `json:"expires_at"`
	NonCustodial   bool      `json:"non_custodial"`
	RequiresWallet bool      `json:"requires_wallet_approval"`
}

type DiscordWalletVerificationRequest struct {
	ConnectionID string `json:"connection_id"`
	HandoffID    string `json:"handoff_id"`
	Evidence     string `json:"evidence"`
}

type DiscordWalletVerification struct {
	HandoffID     string    `json:"handoff_id"`
	ConnectionID  string    `json:"connection_id"`
	DiscordUserID string    `json:"discord_user_id"`
	ChainID       uint64    `json:"chain_id"`
	Account       string    `json:"account"`
	Verified      bool      `json:"verified"`
	Canonical     bool      `json:"canonical"`
	VerifiedAt    time.Time `json:"verified_at"`
	NonCustodial  bool      `json:"non_custodial"`
}

type DiscordWalletVerificationState struct {
	HandoffID     string    `json:"handoff_id"`
	Owner         string    `json:"owner"`
	ConnectionID  string    `json:"connection_id"`
	DiscordUserID string    `json:"discord_user_id"`
	ChainID       uint64    `json:"chain_id"`
	Account       string    `json:"account"`
	PayloadDigest string    `json:"payload_digest"`
	ExpiresAt     time.Time `json:"expires_at"`
	Verified      bool      `json:"verified"`
	VerifiedAt    time.Time `json:"verified_at,omitempty"`
	Version       uint32    `json:"version"`
}

type DiscordWalletVerificationService struct {
	Wallet *WalletActionService
	Store  MailStore
	Now    func() time.Time
}

func NewDiscordWalletVerificationService(wallet *WalletActionService, store MailStore) *DiscordWalletVerificationService {
	return &DiscordWalletVerificationService{
		Wallet: wallet,
		Store:  store,
		Now:    func() time.Time { return time.Now().UTC() },
	}
}

func (s *DiscordWalletVerificationService) Challenge(ctx context.Context, actor string, req DiscordWalletChallengeRequest) (DiscordWalletChallenge, error) {
	actor = strings.TrimSpace(actor)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.Account = strings.TrimSpace(req.Account)
	if actor == "" {
		return DiscordWalletChallenge{}, ErrUnauthorized
	}
	discordUserID, ok := discordUserIDFromConnectionID(req.ConnectionID)
	if !ok || req.ChainID == 0 || !validWalletAddress(req.Account) {
		return DiscordWalletChallenge{}, ErrInvalidInput
	}
	now := s.now()
	if !req.ExpiresAt.After(now) || req.ExpiresAt.After(now.Add(MaxDiscordWalletChallengeTTL)) {
		return DiscordWalletChallenge{}, ErrInvalidInput
	}
	if s == nil || s.Wallet == nil || s.Store == nil {
		return DiscordWalletChallenge{}, errors.New("mail: discord wallet verification dependencies unavailable")
	}
	digest := discordWalletChallengeDigest(actor, req.ConnectionID, discordUserID, req.ChainID, req.Account, req.ExpiresAt)
	explanation := "Verify wallet ownership for linked Discord account " + discordUserID
	handoff, err := s.Wallet.Prepare(ctx, actor, WalletActionRequest{
		Kind: WalletActionMessageSignature, ChainID: req.ChainID, Account: req.Account,
		PayloadDigest: digest, Explanation: explanation, ExpiresAt: req.ExpiresAt,
	})
	if err != nil {
		return DiscordWalletChallenge{}, err
	}
	if handoff.Kind != WalletActionMessageSignature || handoff.ChainID != req.ChainID ||
		!sameAddress(handoff.Account, req.Account) || !strings.EqualFold(handoff.PayloadDigest, digest) ||
		!handoff.ExpiresAt.Equal(req.ExpiresAt) || !handoff.NonCustodial || !handoff.RequiresApproval {
		return DiscordWalletChallenge{}, ErrWalletInvalidResult
	}
	state := DiscordWalletVerificationState{
		HandoffID: handoff.ID, Owner: actor, ConnectionID: req.ConnectionID, DiscordUserID: discordUserID,
		ChainID: req.ChainID, Account: req.Account, PayloadDigest: digest, ExpiresAt: req.ExpiresAt, Version: 1,
	}
	if err := s.Store.Update(ctx, func(data *storeData) error {
		if existing, ok := data.DiscordWalletVerifications[handoff.ID]; ok {
			if !sameDiscordWalletVerificationState(existing, state) {
				return ErrDiscordWalletConflict
			}
			return nil
		}
		data.DiscordWalletVerifications[handoff.ID] = state
		return nil
	}); err != nil {
		return DiscordWalletChallenge{}, err
	}
	return DiscordWalletChallenge{
		HandoffID: handoff.ID, ConnectionID: req.ConnectionID, DiscordUserID: discordUserID,
		ChainID: req.ChainID, Account: req.Account, PayloadDigest: digest, ExpiresAt: req.ExpiresAt,
		NonCustodial: handoff.NonCustodial, RequiresWallet: handoff.RequiresApproval,
	}, nil
}

func (s *DiscordWalletVerificationService) Verify(ctx context.Context, actor string, req DiscordWalletVerificationRequest) (DiscordWalletVerification, error) {
	actor = strings.TrimSpace(actor)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.HandoffID = strings.TrimSpace(req.HandoffID)
	req.Evidence = strings.TrimSpace(req.Evidence)
	if actor == "" {
		return DiscordWalletVerification{}, ErrUnauthorized
	}
	if _, ok := discordUserIDFromConnectionID(req.ConnectionID); !ok || req.HandoffID == "" || len([]byte(req.HandoffID)) > 256 ||
		req.Evidence == "" || len([]byte(req.Evidence)) > MaxWalletVerificationBytes {
		return DiscordWalletVerification{}, ErrInvalidInput
	}
	if s == nil || s.Wallet == nil || s.Store == nil {
		return DiscordWalletVerification{}, errors.New("mail: discord wallet verification dependencies unavailable")
	}
	var state DiscordWalletVerificationState
	var found bool
	if err := s.Store.View(ctx, func(data *storeData) error {
		state, found = data.DiscordWalletVerifications[req.HandoffID]
		return nil
	}); err != nil {
		return DiscordWalletVerification{}, err
	}
	if !found || state.Owner != actor || state.ConnectionID != req.ConnectionID {
		return DiscordWalletVerification{}, ErrDiscordWalletConflict
	}
	if state.Verified {
		return discordWalletResult(state), nil
	}
	if !state.ExpiresAt.After(s.now()) {
		return DiscordWalletVerification{}, ErrDiscordWalletConflict
	}

	verified, err := s.Wallet.Verify(ctx, actor, WalletVerificationRequest{
		Kind: WalletVerifySignature, HandoffID: req.HandoffID, Evidence: req.Evidence,
	})
	if err != nil {
		return DiscordWalletVerification{}, err
	}
	if verified.Kind != WalletVerifySignature || verified.HandoffID != state.HandoffID || verified.Identity != actor ||
		!sameAddress(verified.Account, state.Account) || !verified.Verified || !verified.Canonical ||
		!verified.NonCustodial || verified.VerifiedAt.IsZero() {
		return DiscordWalletVerification{}, ErrWalletInvalidResult
	}

	if err := s.Store.Update(ctx, func(data *storeData) error {
		current, ok := data.DiscordWalletVerifications[state.HandoffID]
		if !ok || current.Owner != state.Owner || current.ConnectionID != state.ConnectionID ||
			!sameAddress(current.Account, state.Account) || current.PayloadDigest != state.PayloadDigest ||
			!current.ExpiresAt.Equal(state.ExpiresAt) {
			return ErrDiscordWalletConflict
		}
		if current.Verified {
			state = current
			return nil
		}
		current.Verified = true
		current.VerifiedAt = verified.VerifiedAt.UTC()
		current.Version++
		data.DiscordWalletVerifications[state.HandoffID] = current
		state = current
		return nil
	}); err != nil {
		return DiscordWalletVerification{}, err
	}
	return discordWalletResult(state), nil
}

func (s *DiscordWalletVerificationService) now() time.Time {
	if s != nil && s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func discordWalletChallengeDigest(actor, connectionID, discordUserID string, chainID uint64, account string, expiresAt time.Time) string {
	normalizedAccount := strings.ToLower(strings.TrimSpace(account))
	payload := strings.Join([]string{
		"420/MAIL/DISCORD/WALLET-VERIFY/V1",
		strings.TrimSpace(actor),
		strings.TrimSpace(connectionID),
		strings.TrimSpace(discordUserID),
		strconv.FormatUint(chainID, 10),
		normalizedAccount,
		expiresAt.UTC().Format(time.RFC3339Nano),
	}, "\x00")
	sum := sha256.Sum256([]byte(payload))
	return "0x" + hex.EncodeToString(sum[:])
}

func sameDiscordWalletVerificationState(a, b DiscordWalletVerificationState) bool {
	return a.HandoffID == b.HandoffID && a.Owner == b.Owner && a.ConnectionID == b.ConnectionID &&
		a.DiscordUserID == b.DiscordUserID && a.ChainID == b.ChainID && sameAddress(a.Account, b.Account) &&
		strings.EqualFold(a.PayloadDigest, b.PayloadDigest) && a.ExpiresAt.Equal(b.ExpiresAt)
}

func discordWalletResult(state DiscordWalletVerificationState) DiscordWalletVerification {
	return DiscordWalletVerification{
		HandoffID: state.HandoffID, ConnectionID: state.ConnectionID, DiscordUserID: state.DiscordUserID,
		ChainID: state.ChainID, Account: state.Account, Verified: state.Verified, Canonical: state.Verified,
		VerifiedAt: state.VerifiedAt, NonCustodial: true,
	}
}

func validateDiscordWalletVerificationData(data *storeData) error {
	for key, state := range data.DiscordWalletVerifications {
		if key == "" || key != state.HandoffID || state.Owner == "" || state.Version == 0 ||
			state.ChainID == 0 || !validWalletAddress(state.Account) || !validDigest(state.PayloadDigest) ||
			state.ExpiresAt.IsZero() {
			return ErrDiscordWalletConflict
		}
		userID, ok := discordUserIDFromConnectionID(state.ConnectionID)
		if !ok || userID != state.DiscordUserID {
			return ErrDiscordWalletConflict
		}
		if state.Verified {
			if state.VerifiedAt.IsZero() {
				return ErrDiscordWalletConflict
			}
		} else if !state.VerifiedAt.IsZero() {
			return ErrDiscordWalletConflict
		}
	}
	return nil
}
