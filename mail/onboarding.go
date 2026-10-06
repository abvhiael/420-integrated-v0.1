package mail

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const MaxOnboardingCredentialBytes = 64 << 10

type OnboardingMethod string

const (
	OnboardingGoogle         OnboardingMethod = "GOOGLE"
	OnboardingApple          OnboardingMethod = "APPLE"
	OnboardingPasskey        OnboardingMethod = "PASSKEY"
	OnboardingExistingWallet OnboardingMethod = "EXISTING_WALLET"
)

var ErrOnboardingInvalidResult = errors.New("mail: invalid onboarding authority result")

type GoogleOnboardingRequest struct {
	IDToken string `json:"id_token"`
}

type AppleOnboardingRequest struct {
	IDToken string `json:"id_token"`
}

type PasskeyOnboardingRequest struct {
	Assertion string `json:"assertion"`
}

type WalletOnboardingRequest struct {
	Address   string `json:"address"`
	Challenge string `json:"challenge"`
	Signature string `json:"signature"`
}

type OnboardingResult struct {
	Method           OnboardingMethod `json:"method"`
	Identity         string           `json:"identity"`
	WalletAddress    string           `json:"wallet_address"`
	SessionToken     string           `json:"session_token"`
	SessionExpiresAt time.Time        `json:"session_expires_at"`
	NonCustodial     bool             `json:"non_custodial"`
}

type OnboardingAuthority interface {
	Google(context.Context, string) (OnboardingResult, error)
	Apple(context.Context, string) (OnboardingResult, error)
	Passkey(context.Context, string) (OnboardingResult, error)
	ExistingWallet(context.Context, string, string, string) (OnboardingResult, error)
}

type OnboardingService struct {
	Authority OnboardingAuthority
	Now       func() time.Time
}

func NewOnboardingService(authority OnboardingAuthority) *OnboardingService {
	return &OnboardingService{
		Authority: authority,
		Now:       func() time.Time { return time.Now().UTC() },
	}
}

func (s *OnboardingService) Google(ctx context.Context, req GoogleOnboardingRequest) (OnboardingResult, error) {
	if err := validateOpaqueCredential(req.IDToken); err != nil {
		return OnboardingResult{}, err
	}
	return s.finish(ctx, OnboardingGoogle, func() (OnboardingResult, error) {
		return s.Authority.Google(ctx, strings.TrimSpace(req.IDToken))
	})
}

func (s *OnboardingService) Apple(ctx context.Context, req AppleOnboardingRequest) (OnboardingResult, error) {
	if err := validateOpaqueCredential(req.IDToken); err != nil {
		return OnboardingResult{}, err
	}
	return s.finish(ctx, OnboardingApple, func() (OnboardingResult, error) {
		return s.Authority.Apple(ctx, strings.TrimSpace(req.IDToken))
	})
}

func (s *OnboardingService) Passkey(ctx context.Context, req PasskeyOnboardingRequest) (OnboardingResult, error) {
	if err := validateOpaqueCredential(req.Assertion); err != nil {
		return OnboardingResult{}, err
	}
	return s.finish(ctx, OnboardingPasskey, func() (OnboardingResult, error) {
		return s.Authority.Passkey(ctx, strings.TrimSpace(req.Assertion))
	})
}

func (s *OnboardingService) ExistingWallet(ctx context.Context, req WalletOnboardingRequest) (OnboardingResult, error) {
	req.Address = strings.TrimSpace(req.Address)
	req.Challenge = strings.TrimSpace(req.Challenge)
	req.Signature = strings.TrimSpace(req.Signature)
	if !validWalletAddress(req.Address) || req.Challenge == "" || req.Signature == "" {
		return OnboardingResult{}, ErrInvalidInput
	}
	if len([]byte(req.Challenge)) > MaxOnboardingCredentialBytes || len([]byte(req.Signature)) > MaxOnboardingCredentialBytes {
		return OnboardingResult{}, ErrInvalidInput
	}
	return s.finish(ctx, OnboardingExistingWallet, func() (OnboardingResult, error) {
		return s.Authority.ExistingWallet(ctx, req.Address, req.Challenge, req.Signature)
	})
}

func (s *OnboardingService) finish(ctx context.Context, method OnboardingMethod, call func() (OnboardingResult, error)) (OnboardingResult, error) {
	if s == nil || s.Authority == nil {
		return OnboardingResult{}, errors.New("mail: onboarding authority unavailable")
	}
	if err := ctx.Err(); err != nil {
		return OnboardingResult{}, err
	}
	out, err := call()
	if err != nil {
		return OnboardingResult{}, fmt.Errorf("mail: onboarding authority: %w", err)
	}
	out = normalizeOnboardingResult(out)
	if err := s.validateResult(method, out); err != nil {
		return OnboardingResult{}, err
	}
	return out, nil
}

func normalizeOnboardingResult(out OnboardingResult) OnboardingResult {
	out.Identity = strings.TrimSpace(out.Identity)
	out.WalletAddress = strings.TrimSpace(out.WalletAddress)
	out.SessionToken = strings.TrimSpace(out.SessionToken)
	return out
}

func (s *OnboardingService) validateResult(method OnboardingMethod, out OnboardingResult) error {
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	if out.Method != method || out.Identity == "" || !validWalletAddress(out.WalletAddress) || out.SessionToken == "" || !out.NonCustodial || !out.SessionExpiresAt.After(now) {
		return ErrOnboardingInvalidResult
	}
	return nil
}

func validateOpaqueCredential(value string) error {
	value = strings.TrimSpace(value)
	if value == "" || len([]byte(value)) > MaxOnboardingCredentialBytes {
		return ErrInvalidInput
	}
	return nil
}

func validWalletAddress(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) != 42 || !strings.HasPrefix(value, "0x") {
		return false
	}
	for _, r := range value[2:] {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return true
}
