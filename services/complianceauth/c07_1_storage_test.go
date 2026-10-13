package complianceauth

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync"
 "testing"
 "time"
 "github.com/lib/pq"
)
func c071TestCipher(t *testing.T)*C071Cipher{t.Helper();c,err:=NewC071Cipher("test-key",map[string][]byte{"test-key":bytes.Repeat([]byte{7},32)});if err!=nil{t.Fatal(err)};return c}
func TestC071AuthenticatedEncryptionBoundaries(t *testing.T){
 c:=c071TestCipher(t);scope:=C064AuthorScope{Tenant:"tenant-a",Domain:"delivery",Jurisdiction:"bc"};aad:=c071AAD("author",scope,"draft1",1);plain:=[]byte("private legal review fixture")
 one,err:=c.seal(plain,aad);if err!=nil{t.Fatal(err)};two,err:=c.seal(plain,aad);if err!=nil||bytes.Equal(one,two)||bytes.Contains(one,plain){t.Fatal("nonce or confidentiality failure",err)}
 decoded,err:=c.open(one,aad);if err!=nil||!bytes.Equal(decoded,plain){t.Fatal("roundtrip",err)}
 other:=scope;other.Tenant="tenant-b"
 for _,wrong:=range [][]byte{c071AAD("author",other,"draft1",1),c071AAD("review",scope,"draft1",1),c071AAD("author",scope,"draft1",2),c071AAD("author",scope,"draft2",1)}{if _,err=c.open(one,wrong);err==nil{t.Fatal("row transplant accepted")}}
 var env c071Envelope;if json.Unmarshal(one,&env)!=nil{t.Fatal("invalid envelope")};env.Ciphertext[0]^=1;tampered,_:=json.Marshal(env);if _,err=c.open(tampered,aad);err==nil{t.Fatal("tampering accepted")}
 for _,bad:=range [][]byte{plain,[]byte("{}"),[]byte(`{"v":2}`),bytes.Repeat([]byte("x"),2*C071MaxPrivateBytes+1)}{if _,err=c.open(bad,aad);err==nil{t.Fatal("invalid ciphertext accepted")}}
 if _,err=c.seal(bytes.Repeat([]byte("x"),C071MaxPrivateBytes+1),aad);err==nil{t.Fatal("oversized payload accepted")}
 for _,key:=range [][]byte{nil,make([]byte,32),bytes.Repeat([]byte{1},16)}{if _,err=NewC071Cipher("test-key",map[string][]byte{"test-key":key});err==nil{t.Fatal("invalid key accepted")}}
 rotated,err:=NewC071Cipher("new-key",map[string][]byte{"test-key":bytes.Repeat([]byte{7},32),"new-key":bytes.Repeat([]byte{9},32)});if err!=nil{t.Fatal(err)}
 if _,err=rotated.open(one,aad);err!=nil{t.Fatal("historical rotation key unavailable",err)}
 removed,_:=NewC071Cipher("new-key",map[string][]byte{"new-key":bytes.Repeat([]byte{9},32)});if _,err=removed.open(one,aad);err==nil{t.Fatal("missing old key accepted")}
 if _,err=OpenC071ProductionStores(context.Background(),"",scope,"bc/delivery",c);err==nil{t.Fatal("missing production DSN accepted")}
}
func TestC071PostgreSQLProductionStorage(t *testing.T){
 raw:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN");if raw==""{t.Fatal("C07.1 requires real PostgreSQL, never a skip")}
 ctx,cancel:=context.WithTimeout(context.Background(),90*time.Second);defer cancel();c:=c071TestCipher(t)
 root,err:=OpenPostgreSQLPublicationStore(raw);if err!=nil{t.Fatal(err)};defer root.DB.Close()
 suffix:=strconv.FormatInt(time.Now().UnixNano(),10);dbName:="c071_"+suffix;roleA:="c071_a_"+suffix;roleB:="c071_b_"+suffix
 // Only this test-owned disposable database and roles are removed.
 if _,err=root.DB.ExecContext(ctx,"CREATE DATABASE "+pq.QuoteIdentifier(dbName));err!=nil{t.Fatal(err)}
 defer func(){root.DB.Exec("DROP DATABASE "+pq.QuoteIdentifier(dbName)+" WITH (FORCE)");root.DB.Exec("DROP ROLE IF EXISTS "+pq.QuoteIdentifier(roleA));root.DB.Exec("DROP ROLE IF EXISTS "+pq.QuoteIdentifier(roleB))}()
 u,err:=url.Parse(raw);if err!=nil{t.Fatal(err)};u.Path="/"+dbName;adminDSN:=u.String()
 admin,err:=OpenPostgreSQLPublicationStore(adminDSN);if err!=nil{t.Fatal(err)};defer admin.DB.Close()
 if err=(C064PostgreSQLDrafts{DB:admin.DB}).Migrate(ctx);err!=nil{t.Fatal(err)}
 if err=(C065PostgreSQLReviews{DB:admin.DB}).Migrate(ctx);err!=nil{t.Fatal(err)}
 if err=(C067PostgreSQLAccessLog{DB:admin.DB}).Migrate(ctx);err!=nil{t.Fatal(err)}
 scopeA:=C064AuthorScope{Tenant:"tenant-a",Domain:"delivery",Jurisdiction:"bc"};scopeB:=scopeA;scopeB.Tenant="tenant-b"
 now:=time.Now().UTC();req:=c064FixtureRequest();cited,digest,err:=c064Resolve(ctx,c064TestSource{},c064FixtureScope,req.Citations,now);if err!=nil{t.Fatal(err)};schema:=req.Schema;schema.SourceDigest=digest
 legacy,err:=(C064PostgreSQLDrafts{DB:admin.DB}).Save(ctx,scopeA,"draft1","author-a",0,schema,cited,now);if err!=nil{t.Fatal(err)}
 legacyReview:=C065ReviewRecord{Scope:scopeA,DraftID:"draft1",Revision:1,DocumentDigest:legacy.DocumentDigest,ReviewerID:"reviewer-b",ImpactDigest:Digest([]byte("impact")),State:"FINDINGS_OPEN",At:now}
 if _,err=(C065PostgreSQLReviews{DB:admin.DB}).AppendIfCurrent(ctx,legacyReview,1,0);err!=nil{t.Fatal("legacy review fixture",err)}
 legacyAudit:=C067AuditAccess{Scope:scopeA,Actor:"auditor-a",CaseID:"case-a",EvidenceID:"evidence-a",Purpose:"LEGAL_AUDIT",Result:"EXPORTED_REDACTED",Time:now}
 if err=(C067PostgreSQLAccessLog{DB:admin.DB}).AppendDurable(ctx,legacyAudit);err!=nil{t.Fatal("legacy audit fixture",err)}
 var valid []byte;if admin.DB.QueryRowContext(ctx,"SELECT document FROM compliance_author_versions WHERE tenant=$1",scopeA.Tenant).Scan(&valid)!=nil{t.Fatal("legacy row missing")}
 oversized:=`{"oversized":"`+strings.Repeat("x",C071MaxPrivateBytes+1)+`"}`
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document=$1 WHERE tenant=$2",oversized,scopeA.Tenant);err!=nil{t.Fatal(err)}
 if MigrateC071Database(ctx,admin.DB,c)==nil{t.Fatal("oversized legacy data migrated")}
 var exists bool;if admin.DB.QueryRowContext(ctx,"SELECT to_regclass('public.compliance_schema_migrations') IS NOT NULL").Scan(&exists)!=nil||exists{t.Fatal("failed migration left partial ledger")}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document=$1 WHERE tenant=$2",string(valid),scopeA.Tenant);err!=nil{t.Fatal(err)}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document_digest=repeat('0',64) WHERE tenant=$1",scopeA.Tenant);err!=nil{t.Fatal(err)}
 if MigrateC071Database(ctx,admin.DB,c)==nil{t.Fatal("corrupt legacy digest accepted")}
 if admin.DB.QueryRowContext(ctx,"SELECT to_regclass('public.compliance_schema_migrations') IS NOT NULL").Scan(&exists)!=nil||exists{t.Fatal("corrupt-backfill rollback left ledger")}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document_digest=$1 WHERE tenant=$2",legacy.DocumentDigest,scopeA.Tenant);err!=nil{t.Fatal(err)}
 var wg sync.WaitGroup;errs:=make(chan error,2)
 for i:=0;i<2;i++{wg.Add(1);go func(){defer wg.Done();errs<-MigrateC071Database(ctx,admin.DB,c)}()};wg.Wait();close(errs);for err=range errs{if err!=nil{t.Fatal("serialized migration",err)}}
 var count int;if admin.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_schema_migrations").Scan(&count)!=nil||count!=5{t.Fatal("migration cardinality",count)}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_schema_migrations SET checksum=repeat('0',64) WHERE version=5");err!=nil{t.Fatal(err)}
 if MigrateC071Database(ctx,admin.DB,c)==nil{t.Fatal("checksum drift accepted")}
 hash:=Digest([]byte(c071HardeningSQL));if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_schema_migrations SET checksum=$1 WHERE version=5",hash);err!=nil{t.Fatal(err)}
 for _,role:=range []string{roleA,roleB}{if _,err=admin.DB.ExecContext(ctx,"CREATE ROLE "+pq.QuoteIdentifier(role)+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'c071-isolated-test-only'");err!=nil{t.Fatal(err)}}
 if err=BindC071RuntimeRole(ctx,admin.DB,roleA,scopeA,"publication-a");err!=nil{t.Fatal(err)}
 if err=BindC071RuntimeRole(ctx,admin.DB,roleB,scopeB,"publication-b");err!=nil{t.Fatal(err)}
 if BindC071RuntimeRole(ctx,admin.DB,roleA,scopeB,"publication-b")==nil{t.Fatal("role scope broadened")}
 roleDSN:=func(role string)string{v:=*u;v.User=url.UserPassword(role,"c071-isolated-test-only");return v.String()}
 a,err:=OpenC071ProductionStores(ctx,roleDSN(roleA),scopeA,"publication-a",c);if err!=nil{t.Fatal("restricted TLS production open",err)};defer a.Close()
 b,err:=OpenC071ProductionStores(ctx,roleDSN(roleB),scopeB,"publication-b",c);if err!=nil{t.Fatal(err)};defer b.Close()
 if _,err=OpenC071ProductionStores(ctx,adminDSN,scopeA,"publication-a",c);err==nil{t.Fatal("superuser production accepted")}
 if _,err=OpenC071ProductionStores(ctx,roleDSN(roleA),scopeB,"publication-a",c);err==nil{t.Fatal("wrong tenant production accepted")}
 if _,err=OpenC071ProductionStores(ctx,roleDSN(roleA),scopeA,"publication-a",nil);err==nil{t.Fatal("plaintext production accepted")}
 insecure,_:=url.Parse(roleDSN(roleA));q:=insecure.Query();q.Set("sslmode","disable");insecure.RawQuery=q.Encode();if _,err=OpenC071ProductionStores(ctx,insecure.String(),scopeA,"publication-a",c);err==nil{t.Fatal("insecure production transport accepted")}
 loaded,err:=a.Drafts.Load(ctx,scopeA,"draft1","author-a",1);if err!=nil||loaded.DocumentDigest!=legacy.DocumentDigest{t.Fatal("legacy encrypted backfill",err)}
 if _,err=b.Drafts.Load(ctx,scopeA,"draft1","author-a",1);err==nil{t.Fatal("cross-role read accepted")}
 if a.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_author_versions").Scan(&count)!=nil||count!=1{t.Fatal("own unfiltered read")}
 if b.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_author_versions").Scan(&count)!=nil||count!=0{t.Fatal("unfiltered tenant leak")}
 if _,err=b.DB.ExecContext(ctx,"INSERT INTO compliance_author_heads(tenant,domain,jurisdiction,draft_id,author_id,revision) VALUES('tenant-a','delivery','bc','bad','author-a',0)");err==nil{t.Fatal("cross-tenant insert accepted")}
 for _,stmt:=range []string{"UPDATE compliance_author_versions SET document='{}'","DELETE FROM compliance_author_versions","TRUNCATE compliance_author_versions","CREATE TABLE public.bad_privilege(id int)","UPDATE compliance_schema_migrations SET version=99","UPDATE compliance_database_bindings SET tenant='tenant-b'"}{if _,err=a.DB.ExecContext(ctx,stmt);err==nil{t.Fatal("runtime privilege accepted",stmt)}}
 var ciphertext []byte;if admin.DB.QueryRowContext(ctx,"SELECT document FROM compliance_author_versions WHERE tenant=$1",scopeA.Tenant).Scan(&ciphertext)!=nil||bytes.Contains(ciphertext,[]byte("author-a")){t.Fatal("private plaintext persisted")}
 record:=C065ReviewRecord{Scope:scopeA,DraftID:"draft1",Revision:1,DocumentDigest:legacy.DocumentDigest,ReviewerID:"reviewer-b",ImpactDigest:Digest([]byte("impact")),State:"FINDINGS_OPEN",At:now}
 if _,err=a.Reviews.AppendIfCurrent(ctx,record,1,1);err!=nil{t.Fatal("encrypted review append",err)}
 if _,err=a.Reviews.AppendIfCurrent(ctx,record,1,2);err!=nil{t.Fatal("encrypted historical review read",err)}
 audit:=C067AuditAccess{Scope:scopeA,Actor:"auditor-a",CaseID:"case-a",EvidenceID:"evidence-a",Purpose:"LEGAL_AUDIT",Result:"EXPORTED_REDACTED",Time:now}
 if err=a.Audit.AppendDurable(ctx,audit);err!=nil{t.Fatal("encrypted audit append",err)}
 var purpose string;if admin.DB.QueryRowContext(ctx,"SELECT purpose FROM compliance_auditor_access WHERE tenant=$1",scopeA.Tenant).Scan(&purpose)!=nil||strings.Contains(purpose,"LEGAL_AUDIT"){t.Fatal("plaintext audit purpose")}
 fence:=PublicationFence{Scope:"publication-a",Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("policy")),DependencyDigest:Digest([]byte("dep")),ExpiresAt:now.Add(time.Hour)}
 if ok,e:=a.Publication.Bootstrap(ctx,fence);e!=nil||!ok{t.Fatal("scoped publication bootstrap",e)}
 if _,err=b.Publication.Load(ctx,"publication-a");err==nil{t.Fatal("cross-scope publication read")}
 if _,err=b.Publication.Bootstrap(ctx,fence);err==nil{t.Fatal("cross-scope publication insert")}
 published,err:=OpenProductionPublicationRuntime(ctx,roleDSN(roleA),refusingPublisher{});if err!=nil{t.Fatal("production publication restricted wiring",err)};published.Close()
 if _,err=OpenProductionPublicationRuntime(ctx,adminDSN,refusingPublisher{});err==nil{t.Fatal("legacy production owner bypass")}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_schema_migrations SET checksum=repeat('0',64) WHERE version=5");err!=nil{t.Fatal(err)}
 if _,err=OpenC071ProductionStores(ctx,roleDSN(roleA),scopeA,"publication-a",c);err==nil{t.Fatal("runtime checksum drift accepted")}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_schema_migrations SET checksum=$1 WHERE version=5",hash);err!=nil{t.Fatal(err)}
 if _,err=a.DB.ExecContext(ctx,"INSERT INTO compliance_author_heads(tenant,domain,jurisdiction,draft_id,author_id,revision) VALUES($1,$2,$3,$4,'author-a',0)",scopeA.Tenant,scopeA.Domain,scopeA.Jurisdiction,strings.Repeat("x",129));err==nil{t.Fatal("unbounded indexed key accepted")}
 schema.Hours.EndLocal="18:00";casErrors:=make(chan error,12);casWins:=0
 for i:=0;i<12;i++{wg.Add(1);go func(){defer wg.Done();_,e:=a.Drafts.Save(ctx,scopeA,"draft1","author-a",1,schema,cited,now);casErrors<-e}()};wg.Wait();close(casErrors)
 for e:=range casErrors{if e==nil{casWins++}else if !errors.Is(e,ErrAuthorConflict){t.Fatal("encrypted CAS",e)}};if casWins!=1{t.Fatal("encrypted CAS winners",casWins)}
 var indexes int;if admin.DB.QueryRowContext(ctx,"SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN('c071_author_owner_history','c071_review_queue','c071_publication_expiry')").Scan(&indexes)!=nil||indexes!=3{t.Fatal("required indexes missing")}
 // Quota admission is serialized in PostgreSQL even across concurrent sessions.
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_storage_usage SET stored_rows=99999 WHERE tenant=$1",scopeA.Tenant);err!=nil{t.Fatal(err)}
 var mu sync.Mutex;wins:=0
 for i:=0;i<12;i++{wg.Add(1);go func(){defer wg.Done();if a.Audit.AppendDurable(ctx,audit)==nil{mu.Lock();wins++;mu.Unlock()}}()};wg.Wait();if wins!=1{t.Fatal("quota race admission winners",wins)}
 if admin.DB.QueryRowContext(ctx,"SELECT stored_rows FROM compliance_storage_usage WHERE tenant=$1",scopeA.Tenant).Scan(&count)!=nil||count!=100000{t.Fatal("quota rollback accounting",count)}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_storage_usage SET stored_rows=10,stored_bytes=67108864 WHERE tenant=$1",scopeA.Tenant);err!=nil{t.Fatal(err)}
 if a.Audit.AppendDurable(ctx,audit)==nil{t.Fatal("byte quota exceeded")}
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_storage_usage SET stored_bytes=0 WHERE tenant=$1",scopeA.Tenant);err!=nil{t.Fatal(err)}
 // Plaintext injection and ciphertext corruption remain unavailable, never fallback.
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document=$1 WHERE tenant=$2",string(valid),scopeA.Tenant);err==nil{t.Fatal("database plaintext constraint bypass")}
 var envelope c071Envelope;if json.Unmarshal(ciphertext,&envelope)!=nil{t.Fatal("stored envelope")};envelope.Ciphertext[0]^=1;bad,_:=json.Marshal(envelope)
 if _,err=admin.DB.ExecContext(ctx,"UPDATE compliance_author_versions SET document=$1 WHERE tenant=$2",string(bad),scopeA.Tenant);err!=nil{t.Fatal(err)}
 if _,err=a.Drafts.Load(ctx,scopeA,"draft1","author-a",1);!errors.Is(err,ErrUnavailable){t.Fatal("corruption did not fail closed",err)}
 cancelled,stop:=context.WithCancel(ctx);stop();if a.Audit.AppendDurable(cancelled,audit)==nil{t.Fatal("cancelled durable append")}
 if err=a.Close();err!=nil{t.Fatal(err)};if a.Audit.AppendDurable(ctx,audit)==nil{t.Fatal("closed database accepted")}
}
