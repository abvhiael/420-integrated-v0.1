package storage

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"io"
	"testing"
)

type s3ResolverStub struct { resolved S3ResolvedObject; err error }
func (s s3ResolverStub) ResolveS3Object(context.Context, S3ObjectAddress) (S3ResolvedObject, error) { return s.resolved, s.err }

type s3ReaderStub struct { result DeveloperRetrieveResult; err error; request DeveloperRetrieveRequest }
func (s *s3ReaderStub) Retrieve(_ context.Context, req DeveloperRetrieveRequest) (DeveloperRetrieveResult, error) { s.request = req; return s.result, s.err }

type s3WriterStub struct { plan DeveloperUploadPlan; receipt DeveloperUploadReceipt; prepared DeveloperUploadPrepareRequest; payload []byte }
func (s *s3WriterStub) Prepare(_ context.Context, req DeveloperUploadPrepareRequest) (DeveloperUploadPlan, error) { s.prepared = req; return s.plan, nil }
func (s *s3WriterStub) Ingest(_ context.Context, _ DeveloperUploadPlan, body io.Reader) (DeveloperUploadReceipt, error) { b, err := io.ReadAll(body); if err != nil { return DeveloperUploadReceipt{}, err }; s.payload = b; return s.receipt, nil }

type s3PutAuthorizerStub struct { called bool; err error }
func (s *s3PutAuthorizerStub) AuthorizeS3Put(_ context.Context, _ S3ResolvedObject) error { s.called = true; return s.err }

type s3DeleteStub struct { called bool; resolved S3ResolvedObject }
func (s *s3DeleteStub) DeleteS3Object(_ context.Context, resolved S3ResolvedObject) error { s.called = true; s.resolved = resolved; return nil }

func s3TestResolved(payload []byte) S3ResolvedObject {
	object := DeveloperObjectRef{ObjectID:"obj", ManifestID:"manifest", ShardIndex:0, ShardRoot:DeveloperShardRoot(payload), SizeBytes:uint64(len(payload)), CommitmentID:"commit"}
	return S3ResolvedObject{Object:object, Access:DeveloperReadAccess{Mode:DeveloperAccessPublic}, Preconditions:DeveloperUploadPreconditions{AgreementID:"agreement", CapacityReservationID:"capacity", CommitmentID:"commit"}}
}

func s3TestReceipt(resolved S3ResolvedObject, uploadID string) DeveloperUploadReceipt {
	return DeveloperUploadReceipt{Version:DeveloperAPIVersion, UploadID:uploadID, Object:resolved.Object, ShardRoot:resolved.Object.ShardRoot, SizeBytes:resolved.Object.SizeBytes}
}

func TestS3GetAndHeadPreserve420IdentityAndUseDistinctETag(t *testing.T) {
	payload := []byte("s3-payload")
	resolved := s3TestResolved(payload)
	reader := &s3ReaderStub{result:DeveloperRetrieveResult{Version:DeveloperAPIVersion, Object:resolved.Object, Route:DeveloperRouteMetadata{Tier:"store", ProviderID:"p", NodeID:"n"}, Payload:payload}}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Reader:reader}
	got, err := adapter.GetObject(context.Background(), S3ObjectAddress{Bucket:" bucket ", Key:" key "}); if err != nil { t.Fatal(err) }
	if !bytes.Equal(got.Payload, payload) || got.Object.CommitmentID != "commit" || reader.request.Object.ManifestID != "manifest" { t.Fatalf("identity drift: %#v %#v", got, reader.request) }
	if got.ETag == resolved.Object.ShardRoot || got.ETag == resolved.Object.CommitmentID { t.Fatalf("S3 ETag reused 420 identity: %q", got.ETag) }
	head, err := adapter.HeadObject(context.Background(), S3ObjectAddress{Bucket:"bucket", Key:"key"}); if err != nil { t.Fatal(err) }
	if head.SizeBytes != uint64(len(payload)) || head.ETag != got.ETag { t.Fatalf("unexpected head %#v", head) }
}

func TestS3PutUsesIdempotent420UploadAndSinglePartETag(t *testing.T) {
	payload := []byte("put-payload")
	resolved := s3TestResolved(payload)
	plan := DeveloperUploadPlan{Version:DeveloperAPIVersion, UploadID:"upload", Object:resolved.Object, IdempotencyKey:"idem", Preconditions:resolved.Preconditions, ServiceID:"store-1"}
	writer := &s3WriterStub{plan:plan, receipt:s3TestReceipt(resolved, "upload")}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:writer}
	got, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"bucket", Key:"key"}, "idem", bytes.NewReader(payload)); if err != nil { t.Fatal(err) }
	if !bytes.Equal(writer.payload, payload) || writer.prepared.IdempotencyKey != "idem" || writer.prepared.Preconditions.CommitmentID != "commit" { t.Fatalf("upload mapping drift: %#v %#v", writer.prepared, writer.payload) }
	sum := md5.Sum(payload)
	want := `"` + hex.EncodeToString(sum[:]) + `"`
	if got.ETag != want || got.ETag == resolved.Object.ShardRoot { t.Fatalf("unexpected S3 ETag %q want %q", got.ETag, want) }
}

func TestS3PrivatePutFailsClosedWithoutWriteAuthorizer(t *testing.T) {
	payload := []byte("private-put")
	resolved := s3TestResolved(payload)
	resolved.Access = DeveloperReadAccess{Mode:DeveloperAccessPrivate, Subject:"subject", SessionID:"session", Capability:GatewayAccessRead}
	writer := &s3WriterStub{plan:DeveloperUploadPlan{Version:DeveloperAPIVersion, UploadID:"upload", Object:resolved.Object}, receipt:s3TestReceipt(resolved, "upload")}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:writer}
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "idem", bytes.NewReader(payload)); !errors.Is(err, ErrS3Compatibility) { t.Fatalf("expected private write default deny, got %v", err) }
	if len(writer.payload) != 0 { t.Fatal("private write reached backend before authorization") }
}

func TestS3PrivatePutUsesExplicitWriteAuthorizer(t *testing.T) {
	payload := []byte("private-put")
	resolved := s3TestResolved(payload)
	resolved.Access = DeveloperReadAccess{Mode:DeveloperAccessPrivate, Subject:"subject", SessionID:"session", Capability:GatewayAccessRead}
	writer := &s3WriterStub{plan:DeveloperUploadPlan{Version:DeveloperAPIVersion, UploadID:"upload", Object:resolved.Object}, receipt:s3TestReceipt(resolved, "upload")}
	auth := &s3PutAuthorizerStub{}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:writer, PutAuthorizer:auth}
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "idem", bytes.NewReader(payload)); err != nil { t.Fatal(err) }
	if !auth.called || !bytes.Equal(writer.payload, payload) { t.Fatalf("authorization/backend flow failed auth=%v payload=%q", auth.called, writer.payload) }
}

func TestS3PrivatePutPropagatesAuthorizationDenial(t *testing.T) {
	payload := []byte("private-put")
	resolved := s3TestResolved(payload)
	resolved.Access = DeveloperReadAccess{Mode:DeveloperAccessPrivate, Subject:"subject", SessionID:"session", Capability:GatewayAccessRead}
	denied := errors.New("write denied")
	auth := &s3PutAuthorizerStub{err:denied}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:&s3WriterStub{}, PutAuthorizer:auth}
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "idem", bytes.NewReader(payload)); !errors.Is(err, denied) { t.Fatalf("expected explicit denial, got %v", err) }
}

func TestS3PutRejectsReceiptIdentitySubstitution(t *testing.T) {
	payload := []byte("put-payload")
	resolved := s3TestResolved(payload)
	plan := DeveloperUploadPlan{Version:DeveloperAPIVersion, UploadID:"upload", Object:resolved.Object, IdempotencyKey:"idem", Preconditions:resolved.Preconditions}
	receipt := s3TestReceipt(resolved, "upload")
	receipt.Object.ManifestID = "substituted"
	writer := &s3WriterStub{plan:plan, receipt:receipt}
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:writer}
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "idem", bytes.NewReader(payload)); !errors.Is(err, ErrS3Compatibility) { t.Fatalf("expected receipt identity rejection, got %v", err) }
}

func TestS3PutRejectsMissingIdempotencyAndOversize(t *testing.T) {
	payload := []byte("payload")
	resolved := s3TestResolved(payload)
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}, Writer:&s3WriterStub{}, MaxBytes:uint64(len(payload)-1)}
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "", bytes.NewReader(payload)); !errors.Is(err, ErrS3Compatibility) { t.Fatalf("expected idempotency rejection, got %v", err) }
	if _, err := adapter.PutObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}, "idem", bytes.NewReader(payload)); !errors.Is(err, ErrS3Compatibility) { t.Fatalf("expected size rejection, got %v", err) }
}

func TestS3DeleteRequiresExplicitCanonicalAwareDeleter(t *testing.T) {
	resolved := s3TestResolved([]byte("payload"))
	adapter := S3CompatibilityAdapter{Resolver:s3ResolverStub{resolved:resolved}}
	if err := adapter.DeleteObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}); !errors.Is(err, ErrS3Unsupported) { t.Fatalf("expected unsupported delete, got %v", err) }
	deleter := &s3DeleteStub{}
	adapter.Deleter = deleter
	if err := adapter.DeleteObject(context.Background(), S3ObjectAddress{Bucket:"b", Key:"k"}); err != nil { t.Fatal(err) }
	if !deleter.called || deleter.resolved.Object.ManifestID != "manifest" { t.Fatalf("delete identity not preserved %#v", deleter) }
}

func TestS3UnsupportedSemanticsFailExplicitly(t *testing.T) {
	adapter := S3CompatibilityAdapter{}
	if !errors.Is(adapter.BeginMultipartUpload(context.Background(), S3ObjectAddress{}), ErrS3Unsupported) { t.Fatal("multipart must fail explicitly") }
	if !errors.Is(adapter.SetACL(context.Background(), S3ObjectAddress{}, "public-read"), ErrS3Unsupported) { t.Fatal("ACL must fail explicitly") }
	if !errors.Is(adapter.SetVersioning(context.Background(), "bucket", true), ErrS3Unsupported) { t.Fatal("versioning must fail explicitly") }
}
