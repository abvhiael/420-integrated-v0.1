package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"

	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
)

var (
	ErrStorageSecurity  = errors.New("reefer review: 420 Storage security requirements unsatisfied")
	ErrStorageIntegrity = errors.New("reefer review: 420 Storage integrity failure")
)

type BlobSecurityProfile struct {
	Qualified420Storage bool
	EncryptedAtRest     bool
	ExternalKeyCustody  bool
	OwnerScopedAccess   bool
	SHA256Integrity     bool
}

type BlobSecurityProvider interface {
	BlobSecurity() BlobSecurityProfile
}

type OwnerScopedBlobStore interface {
	BlobStore
	PutForOwner(context.Context, string, string, []byte) (string, error)
	GetForOwner(context.Context, string, string) ([]byte, error)
}

type Storage420PrivateProvider interface {
	PutPrivate(context.Context, string, string, []byte) (storage420.ObjectRef, error)
	GetPrivate(context.Context, string, storage420.ObjectRef) ([]byte, error)
	SecurityProfile() BlobSecurityProfile
}

type Storage420BlobAdapter struct {
	Provider Storage420PrivateProvider
}

func (a Storage420BlobAdapter) BlobSecurity() BlobSecurityProfile {
	if a.Provider == nil {
		return BlobSecurityProfile{}
	}
	return a.Provider.SecurityProfile()
}

func (a Storage420BlobAdapter) Put(ctx context.Context, digest string, body []byte) (string, error) {
	return "", ErrStorageSecurity
}

func (a Storage420BlobAdapter) Get(ctx context.Context, ref string) ([]byte, error) {
	return nil, ErrStorageSecurity
}

func (a Storage420BlobAdapter) PutForOwner(ctx context.Context, owner, digest string, body []byte) (string, error) {
	if a.Provider == nil || strings.TrimSpace(owner) == "" || strings.TrimSpace(digest) == "" || len(body) == 0 {
		return "", ErrStorageSecurity
	}
	if err := validateBlobSecurity(a); err != nil {
		return "", err
	}
	if !strings.EqualFold(digest, sha256Hex(body)) {
		return "", ErrStorageIntegrity
	}
	object, err := a.Provider.PutPrivate(ctx, strings.TrimSpace(owner), strings.ToLower(strings.TrimSpace(digest)), append([]byte(nil), body...))
	if err != nil {
		return "", err
	}
	if err := validateStorageObject(object, body); err != nil {
		return "", err
	}
	raw, err := json.Marshal(object)
	if err != nil {
		return "", err
	}
	return "storage420:" + base64.RawURLEncoding.EncodeToString(raw), nil
}

func (a Storage420BlobAdapter) GetForOwner(ctx context.Context, owner, ref string) ([]byte, error) {
	if a.Provider == nil || strings.TrimSpace(owner) == "" {
		return nil, ErrStorageSecurity
	}
	if err := validateBlobSecurity(a); err != nil {
		return nil, err
	}
	object, err := decodeStorageRef(ref)
	if err != nil {
		return nil, err
	}
	body, err := a.Provider.GetPrivate(ctx, strings.TrimSpace(owner), object)
	if err != nil {
		return nil, err
	}
	if err := validateStorageObject(object, body); err != nil {
		return nil, err
	}
	return append([]byte(nil), body...), nil
}

func validateBlobSecurity(blobs BlobStore) error {
	security, ok := blobs.(BlobSecurityProvider)
	if !ok {
		return ErrStorageSecurity
	}
	p := security.BlobSecurity()
	if !p.Qualified420Storage || !p.EncryptedAtRest || !p.ExternalKeyCustody || !p.OwnerScopedAccess || !p.SHA256Integrity {
		return ErrStorageSecurity
	}
	if _, ok := blobs.(OwnerScopedBlobStore); !ok {
		return ErrStorageSecurity
	}
	return nil
}

func validateStorageObject(object storage420.ObjectRef, body []byte) error {
	if strings.TrimSpace(object.ObjectID) == "" ||
		strings.TrimSpace(object.ManifestID) == "" ||
		strings.TrimSpace(object.CommitmentID) == "" ||
		strings.TrimSpace(object.ShardRoot) == "" ||
		object.SizeBytes != uint64(len(body)) {
		return ErrStorageIntegrity
	}
	sum := sha256.Sum256(body)
	if !strings.EqualFold(object.ShardRoot, hex.EncodeToString(sum[:])) {
		return ErrStorageIntegrity
	}
	return nil
}

func decodeStorageRef(ref string) (storage420.ObjectRef, error) {
	if !strings.HasPrefix(ref, "storage420:") {
		return storage420.ObjectRef{}, ErrStorageIntegrity
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(ref, "storage420:"))
	if err != nil {
		return storage420.ObjectRef{}, ErrStorageIntegrity
	}
	var object storage420.ObjectRef
	if err := json.Unmarshal(raw, &object); err != nil {
		return storage420.ObjectRef{}, ErrStorageIntegrity
	}
	if strings.TrimSpace(object.ObjectID) == "" || strings.TrimSpace(object.ManifestID) == "" ||
		strings.TrimSpace(object.CommitmentID) == "" || strings.TrimSpace(object.ShardRoot) == "" ||
		object.SizeBytes == 0 {
		return storage420.ObjectRef{}, ErrStorageIntegrity
	}
	return object, nil
}

func sha256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}
