package complianceauth

import (
 "context"
 "database/sql"
 "errors"
 "time"

 _ "github.com/lib/pq"
)

// PostgreSQLPublicationStore uses the same PostgreSQL primary for all instances.
// Callers must not route decisions through lagging replicas. Schema migrations
// must be applied before accepting traffic.
type PostgreSQLPublicationStore struct{ DB *sql.DB }

const PublicationSchemaSQL = `CREATE TABLE IF NOT EXISTS compliance_publication_fences (
 scope TEXT PRIMARY KEY,
 sequence BIGINT NOT NULL CHECK (sequence > 0),
 revocation_epoch BIGINT NOT NULL CHECK (revocation_epoch > 0),
 policy_digest TEXT NOT NULL,
 dependency_digest TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 CHECK (char_length(policy_digest) = 64),
 CHECK (char_length(dependency_digest) = 64)
)`

func OpenPostgreSQLPublicationStore(dsn string)(*PostgreSQLPublicationStore,error){
 if dsn==""{return nil,ErrPublicationStale}
 db,err:=sql.Open("postgres",dsn);if err!=nil{return nil,err}
 db.SetMaxOpenConns(16);db.SetMaxIdleConns(4);db.SetConnMaxLifetime(30*time.Minute)
 return &PostgreSQLPublicationStore{DB:db},nil
}
func(s *PostgreSQLPublicationStore) Migrate(ctx context.Context)error{
 if s==nil||s.DB==nil||ctx==nil{return ErrPublicationStale}
 _,err:=s.DB.ExecContext(ctx,PublicationSchemaSQL);return err
}
func (s *PostgreSQLPublicationStore) Load(ctx context.Context,scope string)(PublicationFence,error){
 if s==nil||s.DB==nil||ctx==nil||ctx.Err()!=nil||scope==""{return PublicationFence{},ErrPublicationStale}
 var p PublicationFence
 // A single primary-stored statement is atomic under READ COMMITTED.
 err:=s.DB.QueryRowContext(ctx,`SELECT scope,sequence,revocation_epoch,policy_digest,dependency_digest,expires_at
 FROM compliance_publication_fences WHERE scope=$1`,scope).Scan(&p.Scope,&p.Sequence,&p.RevocationEpoch,&p.PolicyDigest,&p.DependencyDigest,&p.ExpiresAt)
 if err!=nil{return PublicationFence{},ErrPublicationStale}
 return p,nil
}
func(s *PostgreSQLPublicationStore) CompareAndSwap(ctx context.Context,scope string,old,next PublicationFence)(bool,error){
 if s==nil||s.DB==nil||ctx==nil||ctx.Err()!=nil||scope==""||old.Scope!=scope||next.Scope!=scope||
 !ValidPublicationFence(old,time.Now().UTC())||!ValidPublicationFence(next,time.Now().UTC())||
 next.Sequence<=old.Sequence||next.RevocationEpoch<old.RevocationEpoch||next.Sequence>9223372036854775807||next.RevocationEpoch>9223372036854775807 {return false,ErrPublicationStale}
 // UPDATE is row-locked, atomic and compares every committed authority field.
 // The database refuses stale concurrent writers; no separate read then write.
 result,err:=s.DB.ExecContext(ctx,`UPDATE compliance_publication_fences SET
 sequence=$1, revocation_epoch=$2, policy_digest=$3, dependency_digest=$4, expires_at=$5
 WHERE scope=$6 AND sequence=$7 AND revocation_epoch=$8
 AND policy_digest=$9 AND dependency_digest=$10 AND expires_at=$11
 AND expires_at > clock_timestamp()`,
 int64(next.Sequence),int64(next.RevocationEpoch),next.PolicyDigest,next.DependencyDigest,next.ExpiresAt,scope,
 int64(old.Sequence),int64(old.RevocationEpoch),old.PolicyDigest,old.DependencyDigest,old.ExpiresAt)
 if err!=nil{return false,ErrPublicationStale}
 n,err:=result.RowsAffected();if err!=nil{return false,ErrPublicationStale}
 return n==1,nil
}
// Bootstrap is a privileged single-writer initialization path. It never
// overwrites a previously published scope.
func(s *PostgreSQLPublicationStore) Bootstrap(ctx context.Context,p PublicationFence)(bool,error){
 if s==nil||s.DB==nil||ctx==nil||ctx.Err()!=nil||!ValidPublicationFence(p,time.Now().UTC())||p.Sequence>9223372036854775807||p.RevocationEpoch>9223372036854775807{return false,ErrPublicationStale}
 result,err:=s.DB.ExecContext(ctx,`INSERT INTO compliance_publication_fences
 (scope,sequence,revocation_epoch,policy_digest,dependency_digest,expires_at)
 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (scope) DO NOTHING`,
 p.Scope,int64(p.Sequence),int64(p.RevocationEpoch),p.PolicyDigest,p.DependencyDigest,p.ExpiresAt)
 if err!=nil{return false,ErrPublicationStale}
 n,err:=result.RowsAffected();if err!=nil{return false,errors.Join(ErrPublicationStale,err)}
 return n==1,nil
}
