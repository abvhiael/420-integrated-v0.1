package storage

import (
	"context"
	"strings"
	"time"
)

// ArbitrationEvidenceAccess420 plugs into the EXISTING 420Storage GatewayAccessAuthorizer.
// It does not issue sessions or infer Wallet ownership from 420ID application login.
// The confidential operator-backed session verifier and canonical on-chain case
// reader must both be supplied at deployment, otherwise private access is denied.
type ArbitrationEvidenceAccess420 struct {
	Sessions ArbitrationEvidenceSessionVerifier420
	Canonical ArbitrationEvidenceCanonicalReader420
	Now func() time.Time
}

// ArbitrationEvidenceScope420 is produced only by the trusted app/Wallet session
// authority. Public HTTP headers, a Wallet address string, or a 420ID profile
// alone cannot construct an accepted session.
type ArbitrationEvidenceScope420 struct {
	Subject string
	WalletController string
	VerifiedWalletSession bool
	ChainID uint64
	CaseRegistry string
	CaseID string
	Round uint8
	Submitter string
	EvidenceCommitment string
	Object DeveloperObjectRef
	ExpiresAt time.Time
	Revoked bool
}

type ArbitrationEvidenceCase420 struct {
	ChainID uint64
	CaseRegistry string
	CaseID string
	CurrentRound uint8
	Claimant string
	Respondent string
	Resolver string
	AppealResolver string
}

// The session verifier independently checks the confidential application's
// Wallet-controller authentication and its live session revocation/expiry.
type ArbitrationEvidenceSessionVerifier420 interface {
	VerifyArbitrationEvidenceSession(context.Context, string, string) (ArbitrationEvidenceScope420, error)
}

// The canonical reader checks the actual on-chain CaseRegistry and finality,
// including original submitting account in the exact evidence event. An Indexer
// projection alone never grants access.
type ArbitrationEvidenceCanonicalReader420 interface {
	ReadArbitrationEvidenceCase(context.Context, uint64, string, string) (ArbitrationEvidenceCase420, error)
	VerifyArbitrationEvidenceCommitment(context.Context, uint64, string, string, uint8, string, string) (bool, error)
}

func arbitrationEvidenceEqualAddress(a, b string) bool {
	return a != "" && b != "" && strings.EqualFold(a,b)
}

func arbitrationEvidenceSameObject(object DeveloperObjectRef, req GatewayRequest) bool {
	key:=req.CacheKey
	return object.ObjectID!="" && object.ManifestID!="" && object.ShardRoot!="" &&
		object.CommitmentID!="" && object.SizeBytes>0 &&
		object.ObjectID==key.ObjectID && object.ManifestID==key.ManifestID &&
		object.ShardIndex==key.ShardIndex &&
		strings.EqualFold(object.ShardRoot,key.ShardRoot) &&
		object.SizeBytes==key.SizeBytes && object.CommitmentID==req.CommitmentID
}

func (a ArbitrationEvidenceAccess420) AuthorizeGatewayAccess(ctx context.Context, access GatewayAccess, req GatewayRequest) error {
	if a.Sessions==nil || a.Canonical==nil ||
		access.Mode!=GatewayAccessPrivate || access.Capability!=GatewayAccessRead ||
		access.Subject=="" || access.SessionID=="" || ctx.Err()!=nil {
		return ErrGatewayUnauthorized
	}
	scope,err:=a.Sessions.VerifyArbitrationEvidenceSession(ctx,access.Subject,access.SessionID)
	if err!=nil || !scope.VerifiedWalletSession || scope.Revoked ||
		scope.Subject!=access.Subject || scope.WalletController=="" ||
		scope.CaseID=="" || scope.CaseRegistry=="" ||
		scope.EvidenceCommitment=="" || scope.Submitter=="" ||
		scope.ChainID==0 || scope.Round>3 ||
		!arbitrationEvidenceSameObject(scope.Object,req) {
		return ErrGatewayUnauthorized
	}
	now:=time.Now()
	if a.Now!=nil {now=a.Now()}
	if !scope.ExpiresAt.After(now) || scope.ExpiresAt.After(now.Add(15*time.Minute)) {
		// Grants must be short-lived; long-lived/cached permissions are unsafe.
		return ErrGatewayUnauthorized
	}
	caseState,err:=a.Canonical.ReadArbitrationEvidenceCase(ctx,scope.ChainID,scope.CaseRegistry,scope.CaseID)
	if err!=nil || caseState.ChainID!=scope.ChainID ||
		!arbitrationEvidenceEqualAddress(caseState.CaseRegistry,scope.CaseRegistry) ||
		!strings.EqualFold(caseState.CaseID,scope.CaseID) ||
		scope.Round>caseState.CurrentRound {
		return ErrGatewayUnauthorized
	}
	controller:=scope.WalletController
	resolver:=caseState.Resolver
	if scope.Round>0 {resolver=caseState.AppealResolver}
	if !arbitrationEvidenceEqualAddress(controller,caseState.Claimant) &&
		!arbitrationEvidenceEqualAddress(controller,caseState.Respondent) &&
		!arbitrationEvidenceEqualAddress(controller,resolver) {
		return ErrGatewayUnauthorized
	}
	ok,err:=a.Canonical.VerifyArbitrationEvidenceCommitment(ctx,scope.ChainID,
		scope.CaseRegistry,scope.CaseID,scope.Round,scope.Submitter,scope.EvidenceCommitment)
	if err!=nil || !ok {return ErrGatewayUnauthorized}
	return nil
}

var _ GatewayAccessAuthorizer = ArbitrationEvidenceAccess420{}
