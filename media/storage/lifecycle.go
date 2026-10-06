package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
)

var (
	ErrInvalidAsset        = errors.New("420media storage: invalid asset")
	ErrDependencyMismatch  = errors.New("420media storage: dependency mismatch")
	ErrCanonicalNotReady   = errors.New("420media storage: canonical manifest not ready")
	ErrDeleteUnsupported   = errors.New("420media storage: canonical-aware delete unsupported")
	ErrAccessDenied        = errors.New("420media storage: access denied")
)

type Visibility string

const (
	VisibilityPublic              Visibility = "PUBLIC"
	VisibilityUnlisted            Visibility = "UNLISTED"
	VisibilityFollowers           Visibility = "FOLLOWERS"
	VisibilityCommunityOnly       Visibility = "COMMUNITY_ONLY"
	VisibilityPurchasersOrBackers Visibility = "PURCHASERS_OR_BACKERS"
	VisibilityPrivate             Visibility = "PRIVATE"
	VisibilityOrganizationMembers Visibility = "ORGANIZATION_MEMBERS"
	VisibilityModerators          Visibility = "MODERATORS"
	VisibilityAdmins              Visibility = "ADMINS"
)

type State string

const (
	StateDraft         State = "DRAFT"
	StatePrepared      State = "PREPARED"
	StateUploaded      State = "UPLOADED"
	StateReady         State = "READY"
	StateDeleted       State = "DELETED"
)

type Asset struct {
	ID            string
	OwnerRef      string
	MimeType      string
	Object        storage420.ObjectRef
	Visibility    Visibility
	ProvenanceRef string
	DerivativeOf  string

	UploadID   string
	ProviderID string
	NodeID     string
	ServiceID  string

	State    State
	Revision uint32
}

type UploadReceipt struct {
	Version    string
	UploadID   string
	Object     storage420.ObjectRef
	ProviderID string
	NodeID     string
	ServiceID  string
	SizeBytes  uint64
	ShardRoot  string
}

type Ingestor interface {
	Ingest(context.Context, storage420.UploadPlan, io.Reader) (UploadReceipt, error)
}

type ManifestReader interface {
	Manifest(context.Context, string) (storage420.ManifestDescriptor, error)
}

type CanonicalDeleter interface {
	DeleteMediaAsset(context.Context, Asset) error
}

type Coordinator struct {
	Storage   *storage420.Client
	Ingestor  Ingestor
	Manifests ManifestReader
	Deleter   CanonicalDeleter
}

func (c Coordinator) Prepare(ctx context.Context, asset Asset, idempotencyKey string, pre storage420.UploadPreconditions) (Asset, storage420.UploadPlan, error) {
	if c.Storage == nil || !validDraft(asset) || strings.TrimSpace(idempotencyKey) == "" ||
		strings.TrimSpace(pre.AgreementID) == "" || strings.TrimSpace(pre.CapacityReservationID) == "" ||
		strings.TrimSpace(pre.CommitmentID) == "" || pre.CommitmentID != asset.Object.CommitmentID {
		return Asset{}, storage420.UploadPlan{}, ErrInvalidAsset
	}
	plan, err := c.Storage.PrepareUpload(ctx, storage420.UploadPrepareRequest{
		Version: storage420.APIVersion, Object: asset.Object, IdempotencyKey: idempotencyKey, Preconditions: pre,
	})
	if err != nil {
		return Asset{}, storage420.UploadPlan{}, err
	}
	if !sameObject(plan.Object, asset.Object) || plan.Version != storage420.APIVersion ||
		plan.IdempotencyKey != idempotencyKey || plan.Preconditions != pre ||
		strings.TrimSpace(plan.UploadID) == "" || strings.TrimSpace(plan.ProviderID) == "" ||
		strings.TrimSpace(plan.NodeID) == "" || strings.TrimSpace(plan.ServiceID) == "" {
		return Asset{}, storage420.UploadPlan{}, ErrDependencyMismatch
	}
	out := asset
	out.UploadID = plan.UploadID
	out.ProviderID = plan.ProviderID
	out.NodeID = plan.NodeID
	out.ServiceID = plan.ServiceID
	out.State = StatePrepared
	out.Revision = nextRevision(out.Revision)
	return out, plan, nil
}

func (c Coordinator) Ingest(ctx context.Context, asset Asset, plan storage420.UploadPlan, body io.Reader) (Asset, error) {
	if c.Ingestor == nil || body == nil || asset.State != StatePrepared || !samePlan(asset, plan) {
		return Asset{}, ErrInvalidAsset
	}
	receipt, err := c.Ingestor.Ingest(ctx, plan, body)
	if err != nil {
		// Preserve PREPARED state so the exact idempotent plan can be retried.
		return asset, err
	}
	if receipt.Version != storage420.APIVersion || receipt.UploadID != plan.UploadID ||
		!sameObject(receipt.Object, asset.Object) || receipt.SizeBytes != asset.Object.SizeBytes ||
		!strings.EqualFold(receipt.ShardRoot, asset.Object.ShardRoot) ||
		receipt.ProviderID != plan.ProviderID || receipt.NodeID != plan.NodeID || receipt.ServiceID != plan.ServiceID {
		return asset, ErrDependencyMismatch
	}
	out := asset
	out.State = StateUploaded
	out.Revision = nextRevision(out.Revision)
	return out, nil
}

func (c Coordinator) ConfirmCanonical(ctx context.Context, asset Asset) (Asset, error) {
	if c.Manifests == nil || asset.State != StateUploaded || !validObject(asset.Object) {
		return Asset{}, ErrInvalidAsset
	}
	manifest, err := c.Manifests.Manifest(ctx, asset.Object.ManifestID)
	if err != nil {
		// Canonical read outages do not destroy a valid upload receipt; retry later.
		return asset, err
	}
	if manifest.Version != storage420.APIVersion || manifest.ManifestID != asset.Object.ManifestID ||
		manifest.ObjectID != asset.Object.ObjectID || !manifest.Sealed || !manifest.Retrievable ||
		manifest.DataShards == 0 || manifest.TotalShards < manifest.DataShards ||
		manifest.PlacedShards < manifest.DataShards {
		return asset, ErrCanonicalNotReady
	}
	var matched bool
	for _, shard := range manifest.Shards {
		if shard.ShardIndex != asset.Object.ShardIndex {
			continue
		}
		if !strings.EqualFold(shard.ShardRoot, asset.Object.ShardRoot) ||
			shard.SizeBytes != asset.Object.SizeBytes || shard.CommitmentID != asset.Object.CommitmentID || !shard.Live {
			return asset, ErrDependencyMismatch
		}
		matched = true
		break
	}
	if !matched {
		return asset, ErrCanonicalNotReady
	}
	out := asset
	out.State = StateReady
	out.Revision = nextRevision(out.Revision)
	return out, nil
}

func (c Coordinator) Delete(ctx context.Context, asset Asset) (Asset, error) {
	if asset.State == StateDeleted || asset.State == StateDraft || !validAssetIdentity(asset) {
		return Asset{}, ErrInvalidAsset
	}
	if c.Deleter == nil {
		return asset, ErrDeleteUnsupported
	}
	if err := c.Deleter.DeleteMediaAsset(ctx, asset); err != nil {
		return asset, err
	}
	out := asset
	out.State = StateDeleted
	out.Revision = nextRevision(out.Revision)
	return out, nil
}

func CanProjectPublic(asset Asset) bool {
	return asset.State == StateReady && asset.Visibility == VisibilityPublic
}

func ReadAccess(asset Asset, subject, sessionID string) (storage420.ReadAccess, error) {
	if asset.State != StateReady {
		return storage420.ReadAccess{}, ErrAccessDenied
	}
	switch asset.Visibility {
	case VisibilityPublic, VisibilityUnlisted:
		return storage420.ReadAccess{Mode: storage420.AccessPublic}, nil
	case VisibilityFollowers, VisibilityCommunityOnly, VisibilityPurchasersOrBackers,
		VisibilityPrivate, VisibilityOrganizationMembers, VisibilityModerators, VisibilityAdmins:
		if strings.TrimSpace(subject) == "" || strings.TrimSpace(sessionID) == "" {
			return storage420.ReadAccess{}, ErrAccessDenied
		}
		return storage420.ReadAccess{
			Mode: storage420.AccessPrivate, Subject: strings.TrimSpace(subject),
			SessionID: strings.TrimSpace(sessionID), Capability: "read",
		}, nil
	default:
		return storage420.ReadAccess{}, ErrInvalidAsset
	}
}

func ValidateDerivative(source, derivative Asset) error {
	if !validAssetIdentity(source) || !validAssetIdentity(derivative) ||
		source.ID == derivative.ID || derivative.DerivativeOf != source.ID ||
		source.OwnerRef != derivative.OwnerRef || source.ProvenanceRef == "" ||
		derivative.ProvenanceRef == "" {
		return ErrInvalidAsset
	}
	return nil
}

func validDraft(a Asset) bool {
	return a.State == StateDraft && validAssetIdentity(a) && validObject(a.Object) &&
		strings.HasPrefix(strings.ToLower(strings.TrimSpace(a.MimeType)), "video/") &&
		validVisibility(a.Visibility)
}

func validAssetIdentity(a Asset) bool {
	return strings.TrimSpace(a.ID) != "" && strings.TrimSpace(a.OwnerRef) != "" &&
		strings.TrimSpace(a.ProvenanceRef) != "" && a.Revision > 0
}

func validObject(o storage420.ObjectRef) bool {
	return strings.TrimSpace(o.ObjectID) != "" && strings.TrimSpace(o.ManifestID) != "" &&
		strings.TrimSpace(o.ShardRoot) != "" && o.SizeBytes > 0 && strings.TrimSpace(o.CommitmentID) != ""
}

func validVisibility(v Visibility) bool {
	switch v {
	case VisibilityPublic, VisibilityUnlisted, VisibilityFollowers, VisibilityCommunityOnly,
		VisibilityPurchasersOrBackers, VisibilityPrivate, VisibilityOrganizationMembers,
		VisibilityModerators, VisibilityAdmins:
		return true
	default:
		return false
	}
}

func sameObject(a, b storage420.ObjectRef) bool {
	return a.ObjectID == b.ObjectID && a.ManifestID == b.ManifestID && a.ShardIndex == b.ShardIndex &&
		strings.EqualFold(a.ShardRoot, b.ShardRoot) && a.SizeBytes == b.SizeBytes && a.CommitmentID == b.CommitmentID
}

func samePlan(a Asset, p storage420.UploadPlan) bool {
	return a.UploadID == p.UploadID && a.ProviderID == p.ProviderID && a.NodeID == p.NodeID &&
		a.ServiceID == p.ServiceID && sameObject(a.Object, p.Object)
}

func nextRevision(v uint32) uint32 {
	if v == ^uint32(0) {
		panic(fmt.Sprintf("%v: revision exhausted", ErrInvalidAsset))
	}
	return v + 1
}
