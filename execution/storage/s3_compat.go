package storage

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
)

var (
	ErrS3Compatibility = errors.New("s3 compatibility failure")
	ErrS3Unsupported   = errors.New("s3 operation unsupported")
)

const DefaultS3CompatMaxObjectBytes uint64 = DefaultDeveloperUploadMaxBytes

type S3ObjectAddress struct {
	Bucket string `json:"bucket"`
	Key    string `json:"key"`
}

type S3ResolvedObject struct {
	Address       S3ObjectAddress              `json:"address"`
	Object        DeveloperObjectRef           `json:"object"`
	Access        DeveloperReadAccess          `json:"access"`
	Preconditions DeveloperUploadPreconditions `json:"preconditions"`
}

type S3NamespaceResolver interface {
	ResolveS3Object(context.Context, S3ObjectAddress) (S3ResolvedObject, error)
}

type S3PutAuthorizer interface {
	AuthorizeS3Put(context.Context, S3ResolvedObject) error
}

type S3DeleteAuthorizer interface {
	DeleteS3Object(context.Context, S3ResolvedObject) error
}

type S3PutBackend interface {
	Prepare(context.Context, DeveloperUploadPrepareRequest) (DeveloperUploadPlan, error)
	Ingest(context.Context, DeveloperUploadPlan, io.Reader) (DeveloperUploadReceipt, error)
}

type S3CompatibilityAdapter struct {
	Resolver      S3NamespaceResolver
	Reader        DeveloperResourceAPI
	Writer        S3PutBackend
	PutAuthorizer S3PutAuthorizer
	Deleter       S3DeleteAuthorizer
	MaxBytes      uint64
}

type S3GetResult struct {
	Payload []byte
	ETag    string
	Object  DeveloperObjectRef
	Route   DeveloperRouteMetadata
}

type S3HeadResult struct {
	SizeBytes uint64
	ETag      string
	Object    DeveloperObjectRef
	Route     DeveloperRouteMetadata
}

type S3PutResult struct {
	ETag    string
	Receipt DeveloperUploadReceipt
}

func (a S3CompatibilityAdapter) GetObject(ctx context.Context, address S3ObjectAddress) (S3GetResult, error) {
	resolved, err := a.resolve(ctx, address)
	if err != nil {
		return S3GetResult{}, err
	}
	if a.Reader == nil {
		return S3GetResult{}, ErrS3Compatibility
	}
	result, err := a.Reader.Retrieve(ctx, DeveloperRetrieveRequest{Version: DeveloperAPIVersion, Object: resolved.Object, Access: resolved.Access})
	if err != nil {
		return S3GetResult{}, err
	}
	return S3GetResult{Payload: append([]byte(nil), result.Payload...), ETag: s3PayloadETag(result.Payload), Object: result.Object, Route: result.Route}, nil
}

func (a S3CompatibilityAdapter) HeadObject(ctx context.Context, address S3ObjectAddress) (S3HeadResult, error) {
	got, err := a.GetObject(ctx, address)
	if err != nil {
		return S3HeadResult{}, err
	}
	return S3HeadResult{SizeBytes: uint64(len(got.Payload)), ETag: got.ETag, Object: got.Object, Route: got.Route}, nil
}

func (a S3CompatibilityAdapter) PutObject(ctx context.Context, address S3ObjectAddress, idempotencyKey string, body io.Reader) (S3PutResult, error) {
	resolved, err := a.resolve(ctx, address)
	if err != nil {
		return S3PutResult{}, err
	}
	if a.Writer == nil || body == nil || strings.TrimSpace(idempotencyKey) == "" {
		return S3PutResult{}, ErrS3Compatibility
	}
	// S3 translation must never turn read/session metadata into implicit write authority.
	// Private namespace writes require an explicit write authorizer and fail closed otherwise.
	if resolved.Access.Mode == DeveloperAccessPrivate {
		if a.PutAuthorizer == nil {
			return S3PutResult{}, ErrS3Compatibility
		}
		if err := a.PutAuthorizer.AuthorizeS3Put(ctx, resolved); err != nil {
			return S3PutResult{}, err
		}
	}
	maxBytes := a.MaxBytes
	if maxBytes == 0 {
		maxBytes = DefaultS3CompatMaxObjectBytes
	}
	if resolved.Object.SizeBytes == 0 || resolved.Object.SizeBytes > maxBytes {
		return S3PutResult{}, ErrS3Compatibility
	}
	plan, err := a.Writer.Prepare(ctx, DeveloperUploadPrepareRequest{Version: DeveloperAPIVersion, Object: resolved.Object, IdempotencyKey: strings.TrimSpace(idempotencyKey), Preconditions: resolved.Preconditions})
	if err != nil {
		return S3PutResult{}, err
	}
	etagHash := md5.New() // S3 single-part compatibility tag only; never used as 420 integrity authority.
	receipt, err := a.Writer.Ingest(ctx, plan, io.TeeReader(body, etagHash))
	if err != nil {
		return S3PutResult{}, err
	}
	if !s3ReceiptMatchesResolved(receipt, resolved.Object) {
		return S3PutResult{}, ErrS3Compatibility
	}
	etag := `"` + hex.EncodeToString(etagHash.Sum(nil)) + `"`
	return S3PutResult{ETag: etag, Receipt: receipt}, nil
}

func (a S3CompatibilityAdapter) DeleteObject(ctx context.Context, address S3ObjectAddress) error {
	resolved, err := a.resolve(ctx, address)
	if err != nil {
		return err
	}
	if a.Deleter == nil {
		return ErrS3Unsupported
	}
	return a.Deleter.DeleteS3Object(ctx, resolved)
}

func (a S3CompatibilityAdapter) BeginMultipartUpload(context.Context, S3ObjectAddress) error {
	return fmt.Errorf("%w: multipart upload sessions are not enabled in v1", ErrS3Unsupported)
}

func (a S3CompatibilityAdapter) SetACL(context.Context, S3ObjectAddress, string) error {
	return fmt.Errorf("%w: S3 ACLs cannot override 420 authorization", ErrS3Unsupported)
}

func (a S3CompatibilityAdapter) SetVersioning(context.Context, string, bool) error {
	return fmt.Errorf("%w: S3 versioning is not mapped to 420 canonical identity", ErrS3Unsupported)
}

func (a S3CompatibilityAdapter) resolve(ctx context.Context, address S3ObjectAddress) (S3ResolvedObject, error) {
	if a.Resolver == nil || strings.TrimSpace(address.Bucket) == "" || strings.TrimSpace(address.Key) == "" {
		return S3ResolvedObject{}, ErrS3Compatibility
	}
	address.Bucket = strings.TrimSpace(address.Bucket)
	address.Key = strings.TrimSpace(address.Key)
	resolved, err := a.Resolver.ResolveS3Object(ctx, address)
	if err != nil {
		return S3ResolvedObject{}, err
	}
	resolved.Address = address
	if _, _, err := normalizeDeveloperRetrieveRequest(DeveloperRetrieveRequest{Version: DeveloperAPIVersion, Object: resolved.Object, Access: resolved.Access}); err != nil {
		return S3ResolvedObject{}, ErrS3Compatibility
	}
	return resolved, nil
}

func s3ReceiptMatchesResolved(receipt DeveloperUploadReceipt, object DeveloperObjectRef) bool {
	return receipt.Version == DeveloperAPIVersion &&
		receipt.Object.ObjectID == object.ObjectID &&
		receipt.Object.ManifestID == object.ManifestID &&
		receipt.Object.ShardIndex == object.ShardIndex &&
		strings.EqualFold(strings.TrimSpace(receipt.Object.ShardRoot), strings.TrimSpace(object.ShardRoot)) &&
		receipt.Object.SizeBytes == object.SizeBytes &&
		receipt.Object.CommitmentID == object.CommitmentID &&
		receipt.SizeBytes == object.SizeBytes &&
		strings.EqualFold(strings.TrimSpace(receipt.ShardRoot), strings.TrimSpace(object.ShardRoot))
}

func s3PayloadETag(payload []byte) string {
	sum := md5.Sum(payload)
	return `"` + hex.EncodeToString(sum[:]) + `"`
}
