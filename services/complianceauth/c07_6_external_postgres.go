package complianceauth

import (
 "context"
 "crypto/ed25519"
 "database/sql"
 "errors"
 "fmt"
)

// C076ExternalAuthoritySQL must be installed on an independently operated
// PostgreSQL cluster NEVER restored with the Compliance application database.
// Its credentials and backup policy must have separate control-plane ownership.
const C076ExternalAuthoritySQL = `
CREATE TABLE IF NOT EXISTS public.c076_authority (
 scope TEXT PRIMARY KEY, generation BIGINT NOT NULL CHECK(generation > 0),
 sequence BIGINT NOT NULL CHECK(sequence > 0),
 revocation_epoch BIGINT NOT NULL CHECK(revocation_epoch > 0),
 receipt_count BIGINT NOT NULL CHECK(receipt_count >= 0),
 signed_checkpoint JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS public.c076_deletion_journal (
 scope TEXT NOT NULL REFERENCES public.c076_authority(scope),
 ordinal BIGINT NOT NULL CHECK(ordinal > 0),
 kind TEXT NOT NULL CHECK(kind IN ('DRAFT','AUDIT','JOB')),
 ref TEXT NOT NULL, PRIMARY KEY(scope,ordinal), UNIQUE(scope,kind,ref)
);
REVOKE ALL ON public.c076_authority,public.c076_deletion_journal FROM PUBLIC;
`

// C076ExternalPostgres is a concrete independently operated, strongly
// consistent storage adapter. DB MUST connect to a separate primary with
// authenticated transport, non-application credentials and protected WAL.
type C076ExternalPostgres struct { DB *sql.DB; IssuerKeys map[string]ed25519.PublicKey }

// ReadSigned uses primary locking semantics: replicas and untrusted snapshots
// cannot supply checkpoint authority.
func(b *C076ExternalPostgres) ReadSigned(ctx context.Context,scope string)(C076SignedCheckpoint,error){
 if b==nil||b.DB==nil||ctx==nil||ctx.Err()!=nil||!c051Scope(scope){return C076SignedCheckpoint{},ErrC076UnsafeRestore}
 var primary bool
 var raw []byte
 e:=b.DB.QueryRowContext(ctx,`SELECT NOT pg_is_in_recovery()`).Scan(&primary)
 if e!=nil||!primary{return C076SignedCheckpoint{},ErrC076UnsafeRestore}
 e=b.DB.QueryRowContext(ctx,`SELECT signed_checkpoint FROM public.c076_authority WHERE scope=$1`,scope).Scan(&raw)
 if e!=nil{return C076SignedCheckpoint{},ErrC076UnsafeRestore}
 var signed C076SignedCheckpoint
 if e=decodeC076Checkpoint(raw,&signed);e!=nil||signed.Checkpoint.Scope!=scope||VerifyC076SignedCheckpoint(ctx,signed,b.IssuerKeys)!=nil{return C076SignedCheckpoint{},ErrC076UnsafeRestore}
 return signed,nil
}

// WithCurrent holds a row lock across current-state comparison and the
// callback. ALL writers of authority records must take this same lock.
// It deliberately does NOT claim atomicity with a different service's
// externally visible release: the serving path MUST independently require a
// durable release-generation gate from the authority on each authorization.
func(b *C076ExternalPostgres) WithCurrent(ctx context.Context,expected C076Checkpoint,fn func(context.Context)error)error{
 if b==nil||b.DB==nil||ctx==nil||ctx.Err()!=nil||fn==nil||expected.Generation==0{return ErrC076UnsafeRestore}
 tx,e:=b.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelSerializable});if e!=nil{return ErrC076UnsafeRestore}
 defer tx.Rollback()
 var raw []byte;var primary bool
 if tx.QueryRowContext(ctx,`SELECT NOT pg_is_in_recovery()`).Scan(&primary)!=nil||!primary{return ErrC076UnsafeRestore}
 if tx.QueryRowContext(ctx,`SELECT signed_checkpoint FROM public.c076_authority WHERE scope=$1 FOR UPDATE`,expected.Scope).Scan(&raw)!=nil{return ErrC076UnsafeRestore}
 var signed C076SignedCheckpoint
 if decodeC076Checkpoint(raw,&signed)!=nil||VerifyC076SignedCheckpoint(ctx,signed,b.IssuerKeys)!=nil||signed.Checkpoint!=expected{return ErrC076UnsafeRestore}
 if e=fn(ctx);e!=nil||ctx.Err()!=nil{return ErrC076UnsafeRestore}
 if e=tx.Commit();e!=nil{return ErrC076UnsafeRestore}
 return nil
}

// AdvanceSignedCheckpoint is append-only in authority dimensions and refuses
// any checkpoint whose journal count differs from the persisted journal.
// Both operations execute on the independent primary under a row lock.
func(b *C076ExternalPostgres) AdvanceSignedCheckpoint(ctx context.Context,previous,next C076SignedCheckpoint,appendDeletions []C076Deletion)error{
 if b==nil||b.DB==nil||ctx==nil||ctx.Err()!=nil||previous.Checkpoint.Scope!=next.Checkpoint.Scope||
  VerifyC076SignedCheckpoint(ctx,next,b.IssuerKeys)!=nil||VerifyC076SignedCheckpoint(ctx,previous,b.IssuerKeys)!=nil{return ErrC076UnsafeRestore}
 p,n:=previous.Checkpoint,next.Checkpoint
 if n.Generation<=p.Generation||n.Fence.Sequence<p.Fence.Sequence||n.Fence.RevocationEpoch<p.Fence.RevocationEpoch||
  n.PrivacyReceiptsCount<p.PrivacyReceiptsCount||n.PrivacyReceiptsCount-p.PrivacyReceiptsCount!=uint64(len(appendDeletions)){return ErrC076UnsafeRestore}
 tx,e:=b.DB.BeginTx(ctx,&sql.TxOptions{Isolation:sql.LevelSerializable});if e!=nil{return ErrC076UnsafeRestore}
 defer tx.Rollback()
 var raw []byte
 if tx.QueryRowContext(ctx,`SELECT signed_checkpoint FROM public.c076_authority WHERE scope=$1 FOR UPDATE`,p.Scope).Scan(&raw)!=nil{return ErrC076UnsafeRestore}
 var current C076SignedCheckpoint
 if decodeC076Checkpoint(raw,&current)!=nil||current.Checkpoint!=p||VerifyC076SignedCheckpoint(ctx,current,b.IssuerKeys)!=nil{return ErrC076UnsafeRestore}
 for i,d:=range appendDeletions{
  if !c075Ref(C075Ref{Kind:d.Kind,ID:d.Ref},false){return ErrC076UnsafeRestore}
  if _,e=tx.ExecContext(ctx,`INSERT INTO public.c076_deletion_journal(scope,ordinal,kind,ref) VALUES($1,$2,$3,$4)`,p.Scope,int64(p.PrivacyReceiptsCount)+int64(i)+1,d.Kind,d.Ref);e!=nil{return ErrC076UnsafeRestore}
 }
 payload,e:=encodeC076Checkpoint(next);if e!=nil{return ErrC076UnsafeRestore}
 _,e=tx.ExecContext(ctx,`UPDATE public.c076_authority SET generation=$2,sequence=$3,revocation_epoch=$4,receipt_count=$5,signed_checkpoint=$6 WHERE scope=$1`,p.Scope,int64(n.Generation),int64(n.Fence.Sequence),int64(n.Fence.RevocationEpoch),int64(n.PrivacyReceiptsCount),payload)
 if e!=nil||tx.Commit()!=nil{return ErrC076UnsafeRestore};return nil
}

// ReadWitness binds the externally journaled deletions to the signed record.
// Missing or extra journal rows fail closed in the coordinator's digest check.
func(b *C076ExternalPostgres) ReadWitness(ctx context.Context,scope string)(C076Witness,error){
 signed,e:=b.ReadSigned(ctx,scope);if e!=nil{return C076Witness{},e}
 if signed.Checkpoint.PrivacyReceiptsCount>100000{return C076Witness{},ErrC076UnsafeRestore}
 rows,e:=b.DB.QueryContext(ctx,`SELECT kind,ref FROM public.c076_deletion_journal WHERE scope=$1 ORDER BY ordinal`,scope)
 if e!=nil{return C076Witness{},ErrC076UnsafeRestore};defer rows.Close()
 result:=C076Witness{Checkpoint:signed.Checkpoint}
 for rows.Next(){
  var d C076Deletion
  if rows.Scan(&d.Kind,&d.Ref)!=nil||len(result.Deletions)>=100000{return C076Witness{},ErrC076UnsafeRestore}
  result.Deletions=append(result.Deletions,d)
 }
 if rows.Err()!=nil||uint64(len(result.Deletions))!=signed.Checkpoint.PrivacyReceiptsCount{return C076Witness{},ErrC076UnsafeRestore}
 return result,nil
}

var _ C076MonotonicBackend=(*C076ExternalPostgres)(nil)
var _ = errors.Is
var _ = fmt.Sprintf
