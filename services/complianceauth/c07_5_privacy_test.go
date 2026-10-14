package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "net/url"
 "os"
 "strconv"
 "strings"
 "sync"
 "sync/atomic"
 "testing"
 "time"
 "github.com/lib/pq"
)

type c075TestAuthority struct{mu sync.Mutex;grants map[string]C075Grant;calls,denyAfter int}
func(a *c075TestAuthority)VerifyPrivacyGrant(ctx context.Context,token string)(C075Grant,error){a.mu.Lock();defer a.mu.Unlock();a.calls++;g,ok:=a.grants[token];if !ok||ctx.Err()!=nil{return C075Grant{},ErrC075Denied};if a.denyAfter>0&&a.calls>=a.denyAfter{g.Revoked=true};return g,nil}
func(a *c075TestAuthority)set(token string,g C075Grant){a.mu.Lock();defer a.mu.Unlock();a.grants[token]=g}
type c075Fixture struct{base *c072Fixture;auth *c075TestAuthority;stores map[string]*C075Store;roles map[string]string;owners,reviewers map[string]ed25519.PublicKey;owner,reviewer ed25519.PrivateKey}
func c075Setup(t *testing.T)*c075Fixture{
 t.Helper();base:=c072Setup(t);f:=&c075Fixture{base:base,auth:&c075TestAuthority{grants:map[string]C075Grant{}},stores:map[string]*C075Store{},roles:map[string]string{}}
 op,ok,_:=ed25519.GenerateKey(rand.Reader);rp,rk,_:=ed25519.GenerateKey(rand.Reader);f.owner=ok;f.reviewer=rk;f.owners=map[string]ed25519.PublicKey{"data-owner":op};f.reviewers=map[string]ed25519.PublicKey{"privacy-reviewer":rp}
 raw,_:=url.Parse(os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN"));var dbname string;if base.admin.QueryRow("SELECT current_database()").Scan(&dbname)!=nil{t.Fatal("fixture database")};raw.Path="/"+dbname
 for _,cap:=range []string{"purge","hold","release","retire","self-release"}{
  role:="c075_"+strings.ReplaceAll(cap,"-","_")+"_"+strconv.FormatInt(time.Now().UnixNano(),10)
  if _,e:=base.admin.ExecContext(base.ctx,"CREATE ROLE "+pq.QuoteIdentifier(role)+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'c075-disposable-fixture'");e!=nil{t.Fatal(e)}
  t.Cleanup(func(){if _,e:=base.admin.Exec("DROP OWNED BY "+pq.QuoteIdentifier(role));e!=nil{t.Errorf("fixture privilege cleanup: %v",e)};root,_:=OpenPostgreSQLPublicationStore(os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN"));if root!=nil{if _,e:=root.DB.Exec("DROP ROLE IF EXISTS "+pq.QuoteIdentifier(role));e!=nil{t.Errorf("fixture role cleanup: %v",e)};root.DB.Close()}})
  principal:="privacy-"+cap;bindingCap:=cap;if cap=="self-release"{principal="privacy-hold";bindingCap="release"}
  if e:=BindC075PrivacyRole(base.ctx,base.admin,role,base.initial.Scope,base.scope,principal,bindingCap,time.Now().Add(time.Hour));e!=nil{t.Fatal("privacy role",cap,e)}
  dsn:=*raw;dsn.User=url.UserPassword(role,"c075-disposable-fixture");db,e:=OpenPostgreSQLPublicationStore(dsn.String());if e!=nil{t.Fatal(e)};t.Cleanup(func(){db.DB.Close()})
  f.roles[cap]=role;f.stores[cap]=&C075Store{DB:db.DB,Scope:base.scope,PublicationScope:base.initial.Scope,Authority:f.auth}
 }
 return f
}
func(f *c075Fixture)policy(t *testing.T,kind string,version uint64,revoked bool){
 t.Helper();p:=C075Policy{Scope:f.base.scope,Kind:kind,Version:version,RetainDays:1,ApprovalDigest:Digest([]byte("independently signed fixture-only policy")),OwnerID:"data-owner",ReviewerID:"privacy-reviewer",ExpiresAt:time.Now().Add(time.Hour),Revoked:revoked}
 p.OwnerSignature=ed25519.Sign(f.owner,c075PolicyBytes(p));p.ReviewerSignature=ed25519.Sign(f.reviewer,c075PolicyBytes(p))
 if e:=InstallC075RetentionPolicy(f.base.ctx,f.base.admin,f.base.initial.Scope,p,C075SignedPolicies{f.owners,f.reviewers});e!=nil{t.Fatal("signed policy install",e)}
}
func(f *c075Fixture)grant(cap string,ref C075Ref,caseID string,revision uint64)string{
 capability:=cap;principal:="privacy-"+cap;operation:=strings.ToUpper(cap)
 if cap=="self-release"{capability="release";principal="privacy-hold";operation="RELEASE"};if cap=="scan"{capability="purge";principal="privacy-purge"}
 token:="opaque-privacy-fixture-"+cap+"-"+ref.Kind+"-"+ref.ID+"-"+caseID+"-"+strconv.FormatUint(revision,10)
 f.auth.set(token,C075Grant{Scope:f.base.scope,PrincipalID:principal,SessionID:"independent-session",Capability:capability,Operation:operation,Ref:ref,CaseID:caseID,ExpectedRevision:revision,OwnerFinalized:true,ExpiresAt:time.Now().Add(time.Minute)})
 return token
}
func(f *c075Fixture)draft(t *testing.T,id string){
 t.Helper();req:=c064FixtureRequest();now:=time.Now().UTC().Add(-3*24*time.Hour)
 citations,digest,e:=c064Resolve(f.base.ctx,c064TestSource{},c064FixtureScope,req.Citations,time.Now());if e!=nil{t.Fatal(e)}
 schema:=req.Schema;schema.PolicyID=id;schema.LegalJurisdictionID=f.base.scope.Jurisdiction;schema.SourceDigest=digest
 store:=C064PostgreSQLDrafts{DB:f.base.a.Durable.DB,Cipher:c071TestCipher(t)}
 draft,e:=store.Save(f.base.ctx,f.base.scope,id,"author-owner",0,schema,citations,now);if e!=nil{t.Fatal("draft",e)}
 review:=C065ReviewRecord{Scope:f.base.scope,DraftID:id,Revision:1,DocumentDigest:draft.DocumentDigest,ReviewerID:"independent-reviewer",ImpactDigest:Digest([]byte("impact")),State:"FINDINGS_OPEN",At:now}
 if _,e=(C065PostgreSQLReviews{DB:store.DB,Cipher:store.Cipher}).AppendIfCurrent(f.base.ctx,review,1,0);e!=nil{t.Fatal("review",e)}
}
func(f *c075Fixture)closeDraft(t *testing.T,id string){t.Helper();if _,e:=f.base.admin.ExecContext(f.base.ctx,"UPDATE compliance_publication_fences SET expires_at=clock_timestamp()-interval '1 second' WHERE scope=$1",f.base.initial.Scope);e!=nil{t.Fatal(e)};ref:=C075Ref{"DRAFT",id};if _,e:=f.stores["retire"].Retire(f.base.ctx,f.grant("retire",ref,"",1),ref);e!=nil{t.Fatal("retire",e)}}
func(f *c075Fixture)ageDraft(t *testing.T,id string){t.Helper();if _,e:=f.base.admin.ExecContext(f.base.ctx,"UPDATE compliance_privacy_retired SET retired_at=clock_timestamp()-interval '3 days' WHERE scope=$1 AND ref=$2",f.base.initial.Scope,id);e!=nil{t.Fatal(e)}}
func TestC075SignedPolicyAndOwnershipBoundaries(t *testing.T){
 op,ok,_:=ed25519.GenerateKey(rand.Reader);rp,rk,_:=ed25519.GenerateKey(rand.Reader)
 p:=C075Policy{Scope:c064FixtureScope,Kind:"DRAFT",Version:1,RetainDays:30,ApprovalDigest:Digest([]byte("fixture")),OwnerID:"owner",ReviewerID:"reviewer",ExpiresAt:time.Now().Add(time.Hour)}
 p.OwnerSignature=ed25519.Sign(ok,c075PolicyBytes(p));p.ReviewerSignature=ed25519.Sign(rk,c075PolicyBytes(p));trust:=C075SignedPolicies{map[string]ed25519.PublicKey{"owner":op},map[string]ed25519.PublicKey{"reviewer":rp}}
 if trust.VerifyRetentionPolicy(context.Background(),p)!=nil{t.Fatal("valid independent signatures")}
 for _,change:=range []func(*C075Policy){func(p *C075Policy){p.RetainDays=0},func(p *C075Policy){p.RetainDays++},func(p *C075Policy){p.Scope.Tenant="foreign"},func(p *C075Policy){p.ReviewerID=p.OwnerID},func(p *C075Policy){p.OwnerSignature=nil},func(p *C075Policy){p.Kind="DELIVERY"},func(p *C075Policy){p.ExpiresAt=time.Now().Add(-time.Minute)}}{bad:=p;change(&bad);if trust.VerifyRetentionPolicy(context.Background(),bad)==nil{t.Fatal("unsigned/invalid policy change accepted")}}
 for _,kind:=range []string{"DELIVERY","ORDER","PAY","WALLET","IDENTITY_IMAGE"}{if c075Ref(C075Ref{kind,"record"},false){t.Fatal("foreign owner admitted",kind)}}
 if _,e:=(&C075Store{}).Purge(context.Background(),"opaque-privacy-fixture-token",C075Ref{"JOB","record"});e==nil{t.Fatal("unconfigured deletion")}
 if _,e:=OpenC075ManagedPrivacy(context.Background(),nil,nil);e==nil{t.Fatal("unmanaged privacy factory")}
}
func TestC075PostgreSQLRetentionHoldsAndPurge(t *testing.T){
 f:=c075Setup(t);ctx:=f.base.ctx;ref:=C075Ref{"DRAFT","draft1"};f.draft(t,ref.ID);purgeToken:=f.grant("purge",ref,"",0)
 if _,e:=f.stores["purge"].Purge(ctx,purgeToken,ref);e==nil{t.Fatal("no approved policy deleted")};f.policy(t,"DRAFT",1,false)
 if _,e:=f.stores["retire"].Retire(ctx,f.grant("retire",ref,"",1),ref);e==nil{t.Fatal("active publication retired")}
 if _,e:=f.base.admin.ExecContext(ctx,"UPDATE compliance_publication_fences SET expires_at=clock_timestamp()-interval '1 second' WHERE scope=$1",f.base.initial.Scope);e!=nil{t.Fatal(e)}
 if _,e:=f.stores["retire"].Retire(ctx,f.grant("retire",ref,"",2),ref);e==nil{t.Fatal("stale retirement accepted")};f.closeDraft(t,ref.ID)
 if _,e:=f.stores["purge"].Purge(ctx,purgeToken,ref);e==nil{t.Fatal("caller old CreatedAt bypassed retirement clock")};f.ageDraft(t,ref.ID)
 pending:=f.auth.grants[purgeToken];pending.OwnerFinalized=false;f.auth.set("pending-owner-privacy-token",pending);if _,e:=f.stores["purge"].Purge(ctx,"pending-owner-privacy-token",ref);e==nil{t.Fatal("owner finality not required")}
 hold:=f.grant("hold",ref,"case-a",0);if _,e:=f.stores["hold"].Hold(ctx,hold,ref);e!=nil{t.Fatal(e)}
 var wg sync.WaitGroup;var deleted atomic.Int32
 for i:=0;i<12;i++{wg.Add(1);go func(){defer wg.Done();if _,e:=f.stores["purge"].Purge(ctx,purgeToken,ref);e==nil{deleted.Add(1)}}()};wg.Wait();if deleted.Load()!=0{t.Fatal("held material deleted")}
 if _,e:=f.stores["self-release"].Release(ctx,f.grant("self-release",ref,"case-a",1),ref);e==nil{t.Fatal("self-release accepted")}
 if _,e:=f.stores["release"].Release(ctx,f.grant("release",ref,"case-a",0),ref);e==nil{t.Fatal("stale hold release")}
 release:=f.grant("release",ref,"case-a",1);if _,e:=f.stores["release"].Release(ctx,release,ref);e!=nil{t.Fatal(e)};if _,e:=f.stores["release"].Release(ctx,release,ref);e==nil{t.Fatal("release replay changed hold")}
 for _,query:=range []string{"DELETE FROM compliance_author_versions","SELECT public.c075_purge('privacy-purge','DRAFT','draft1')","SELECT public.c075_hold('privacy-hold','DRAFT','draft1','forged',0,false)"}{if _,e:=f.base.a.Durable.DB.ExecContext(ctx,query);e==nil{t.Fatal("app role privacy bypass",query)}}
 var beforeBytes,beforeRows int64;if f.base.admin.QueryRowContext(ctx,"SELECT stored_bytes,stored_rows FROM compliance_storage_usage WHERE tenant=$1",f.base.scope.Tenant).Scan(&beforeBytes,&beforeRows)!=nil{t.Fatal("quota baseline")}
 for i:=0;i<12;i++{wg.Add(1);go func(){defer wg.Done();n,e:=f.stores["purge"].Purge(ctx,purgeToken,ref);if e==nil&&n==4{deleted.Add(1)}}()};wg.Wait();if deleted.Load()!=12{t.Fatal("idempotent purge recovery",deleted.Load())}
 var receiptCount int;var removedBytes,removedRows,afterBytes,afterRows int64
 if f.base.admin.QueryRowContext(ctx,"SELECT count(*),sum(removed_bytes),sum(removed_rows) FROM compliance_privacy_receipts WHERE scope=$1",f.base.initial.Scope).Scan(&receiptCount,&removedBytes,&removedRows)!=nil||receiptCount!=1||removedRows!=4{t.Fatal("duplicate or partial receipt")}
 if f.base.admin.QueryRowContext(ctx,"SELECT stored_bytes,stored_rows FROM compliance_storage_usage WHERE tenant=$1",f.base.scope.Tenant).Scan(&afterBytes,&afterRows)!=nil||afterBytes!=beforeBytes-removedBytes||afterRows!=beforeRows-4{t.Fatal("deletion quota drift")}
 var n int;if f.base.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_author_versions").Scan(&n)!=nil||n!=0{t.Fatal("ciphertext not deleted")}
 if f.base.other.Durable.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_privacy_receipts").Scan(&n)!=nil||n!=0{t.Fatal("privacy receipt tenant leak")}
 f.draftRecreationDenied(t,ref.ID)
 if _,e:=f.stores["hold"].Hold(ctx,f.grant("hold",ref,"late-case",0),ref);e==nil{t.Fatal("hold claimed purged evidence")}
 t.Log("PASS: independent signed retention, active/stale/timing denial, 12 held deletion denials, separate release, 12 idempotent purges/one receipt, actual ciphertext deletion, quota conservation, tenant isolation and no identity reuse")
}
func(f *c075Fixture)draftRecreationDenied(t *testing.T,id string){t.Helper();req:=c064FixtureRequest();citations,digest,_:=c064Resolve(f.base.ctx,c064TestSource{},c064FixtureScope,req.Citations,time.Now());schema:=req.Schema;schema.PolicyID=id;schema.LegalJurisdictionID=f.base.scope.Jurisdiction;schema.SourceDigest=digest;if _,e:=(C064PostgreSQLDrafts{DB:f.base.a.Durable.DB,Cipher:c071TestCipher(t)}).Save(f.base.ctx,f.base.scope,id,"author-owner",0,schema,citations,time.Now());e==nil{t.Fatal("purged reference recreated")}}

type c075Map struct{ref C075Ref}
func(m c075Map)PrivacyRef(context.Context,C064AuthorScope,string,string)(C075Ref,error){return m.ref,nil}
type c075HookLog struct{log C067AccessLog;hook func()}
func(l c075HookLog)AppendDurable(ctx context.Context,a C067AuditAccess)error{if e:=l.log.AppendDurable(ctx,a);e!=nil{return e};if l.hook!=nil{l.hook()};return nil}
func TestC075CaseLimitedEvidenceAndPostLogRevalidation(t *testing.T){
 f:=c075Setup(t);f.policy(t,"DRAFT",1,false);f.draft(t,"draft1");ctx:=f.base.ctx;ref:=C075Ref{"DRAFT","draft1"}
 authority:=&c067TestAuthority{session:C067AuditorSession{SubjectID:"auditor",SessionID:"case-session",Scope:f.base.scope,CaseID:"case-a",Role:"auditor",ExpiresAt:time.Now().Add(time.Minute)}}
 repo:=C075AuditorRepository{DB:f.base.a.Durable.DB,Scope:f.base.scope,PublicationScope:f.base.initial.Scope,Mapping:c075Map{ref},Repository:c067TestRepo{item:C067EvidenceItem{SourceID:"source1",EvidenceID:"evidence1",Digest:Digest([]byte("source")),Status:"PARSED_PENDING_REVIEW",ObservedAt:time.Now().Add(-time.Minute)}}}
 audit:=C067PostgreSQLAccessLog{DB:f.base.a.Durable.DB,Cipher:c071TestCipher(t)};service,e:=NewC075AuditorService(authority,repo,audit);if e!=nil{t.Fatal(e)};requests:=[]C067EvidenceRequest{{SourceID:"source1",EvidenceID:"evidence1",Purpose:"LEGAL_AUDIT"}}
 rawService:=C067AuditorService{Authority:authority,Repository:repo.Repository,Log:audit};if _,e=rawService.Export(ctx,"independent-auditor-case-token",requests);e==nil{t.Fatal("encrypted production log accepted ungated repository")}
 if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e!=nil{t.Fatal("authorized redacted export",e)}
 if _,e=f.stores["hold"].Hold(ctx,f.grant("hold",ref,"case-a",0),ref);e!=nil{t.Fatal(e)}
 if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e!=nil{t.Fatal("holding case cannot inspect",e)}
 authority.session.CaseID="foreign-case";if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e==nil{t.Fatal("foreign case read held evidence")};authority.session.CaseID="case-a"
 requests[0].Purpose="SOURCE_VERIFICATION";if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e==nil{t.Fatal("held evidence purpose bypass")};requests[0].Purpose="LEGAL_AUDIT"
 service.Log=c075HookLog{log:audit,hook:func(){if _,e:=f.stores["hold"].Hold(ctx,f.grant("hold",ref,"case-b",0),ref);e!=nil{t.Fatal(e)}}}
 if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e==nil{t.Fatal("post-log hold race leaked export")}
 if _,e=repo.Inspect(ctx,f.base.scope,"source1","evidence1");e==nil{t.Fatal("case-free evidence bypass")}
 authority.session.Role="author";if _,e=service.Export(ctx,"independent-auditor-case-token",requests);e==nil{t.Fatal("author got auditor evidence")}
 if _,e=f.stores["hold"].Hold(ctx,f.grant("hold",C075Ref{"ALL","scope"},"scope-case",0),C075Ref{"ALL","scope"});e!=nil{t.Fatal("scope-wide hold",e)}
 t.Log("PASS: case/purpose/tenant-bound redacted export, held case positive, foreign case and role denial, durable logging and post-log hold revalidation")
}

func TestC075AtomicRollbackAndGrantRevocation(t *testing.T){
 f:=c075Setup(t);ctx:=f.base.ctx;f.policy(t,"AUDIT",1,false)
 audit:=C067AuditAccess{Actor:"auditor",CaseID:"case1",Scope:f.base.scope,EvidenceID:"evidence1",Purpose:"LEGAL_AUDIT",Result:"EXPORTED_REDACTED",Time:time.Now().Add(-3*24*time.Hour)}
 if (C067PostgreSQLAccessLog{DB:f.base.a.Durable.DB,Cipher:c071TestCipher(t)}).AppendDurable(ctx,audit)!=nil{t.Fatal("audit fixture")}
 ref:=C075Ref{"AUDIT","1"};token:=f.grant("purge",ref,"",0)
 if _,e:=f.stores["purge"].Purge(ctx,token,ref);e==nil{t.Fatal("caller-controlled old audit clock bypass")}
 if _,e:=f.base.admin.ExecContext(ctx,"UPDATE compliance_privacy_terminal SET closed_at=clock_timestamp()-interval '3 days' WHERE scope=$1",f.base.initial.Scope);e!=nil{t.Fatal(e)}
 f.auth.mu.Lock();f.auth.calls=0;f.auth.denyAfter=3;f.auth.mu.Unlock()
 if _,e:=f.stores["purge"].Purge(ctx,token,ref);e==nil{t.Fatal("revocation during mutation committed")}
 f.auth.mu.Lock();f.auth.denyAfter=0;f.auth.mu.Unlock()
 var rows int;if f.base.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_auditor_access").Scan(&rows)!=nil||rows!=1{t.Fatal("revoked deletion did not roll back")}
 if _,e:=f.base.admin.ExecContext(ctx,"CREATE FUNCTION public.c075_fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture receipt outage'; END $$; CREATE TRIGGER c075_fixture_fail BEFORE INSERT ON compliance_privacy_receipts FOR EACH ROW EXECUTE FUNCTION public.c075_fixture_fail()");e!=nil{t.Fatal(e)}
 if _,e:=f.stores["purge"].Purge(ctx,token,ref);e==nil{t.Fatal("receipt failure accepted")}
 if f.base.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_auditor_access").Scan(&rows)!=nil||rows!=1{t.Fatal("receipt failure lost evidence")}
 if _,e:=f.base.admin.ExecContext(ctx,"DROP TRIGGER c075_fixture_fail ON compliance_privacy_receipts; DROP FUNCTION public.c075_fixture_fail()");e!=nil{t.Fatal(e)}
 f.policy(t,"AUDIT",2,true);if _,e:=f.stores["purge"].Purge(ctx,token,ref);e==nil{t.Fatal("revoked latest policy fell back to old approval")};f.policy(t,"AUDIT",3,false)
 if _,e:=f.stores["purge"].Purge(ctx,token,ref);e!=nil{t.Fatal("eligible audit purge",e)}
 cancelled,cancel:=context.WithCancel(ctx);cancel();if _,e:=f.stores["purge"].Purge(cancelled,token,ref);e==nil{t.Fatal("cancelled operation accepted")}
 wrong:=f.auth.grants[token];wrong.Scope.Tenant="other";f.auth.set("foreign-opaque-privacy-token",wrong);if _,e:=f.stores["purge"].Purge(ctx,"foreign-opaque-privacy-token",ref);e==nil{t.Fatal("cross-scope grant accepted")}
 if _,e:=f.base.admin.ExecContext(ctx,"UPDATE compliance_privacy_roles SET valid_until=clock_timestamp()-interval '1 second' WHERE capability='purge'");e!=nil{t.Fatal(e)}
 if _,e:=f.stores["purge"].Purge(ctx,token,ref);e==nil{t.Fatal("expired worker binding accepted")}
}

type c075Tokens struct{f *c075Fixture}
func(t c075Tokens)TokenForPrivacyRef(_ context.Context,ref C075Ref)(string,error){return t.f.grant("purge",ref,"",0),nil}
func TestC075BoundedDeletionScheduler(t *testing.T){
 f:=c075Setup(t);ctx:=f.base.ctx;f.policy(t,"JOB",1,false);s:=f.base.a.Durable
 leader,e:=s.AcquireLeader(ctx,"COLLECTION","worker",time.Minute);if e!=nil{t.Fatal(e)}
 ref:=C075Ref{"JOB","retention-job"};if s.Enqueue(ctx,ref.ID,"COLLECTION",map[string]string{"source":"fixture"},time.Now().Add(-3*24*time.Hour),2)!=nil{t.Fatal("job enqueue")};job,e:=s.Claim(ctx,leader,"COLLECTION",time.Minute);if e!=nil||s.FinishJob(ctx,leader,job,true)!=nil{t.Fatal("job finalize",e)}
 scan:=f.grant("scan",C075Ref{"JOB","retention-scan"},"",0)
 refs,e:=f.stores["purge"].Due(ctx,scan);if e!=nil||len(refs)!=0{t.Fatal("completion clock not enforced",e)}
 if _,e=f.base.admin.ExecContext(ctx,"UPDATE compliance_privacy_terminal SET closed_at=clock_timestamp()-interval '3 days' WHERE scope=$1",f.base.initial.Scope);e!=nil{t.Fatal(e)}
 completed,e:=f.stores["purge"].RunRetention(ctx,scan,c075Tokens{f});if e!=nil||completed!=1{t.Fatal("bounded retention worker",completed,e)}
 refs,e=f.stores["purge"].Due(ctx,scan);if e!=nil||len(refs)!=0{t.Fatal("purged record rediscovered",e)}
 if s.Enqueue(ctx,ref.ID,"COLLECTION",map[string]string{"source":"fixture"},time.Now(),2)==nil{t.Fatal("purged job replay recreated data")}
 if _,e=f.stores["purge"].Purge(ctx,scan,ref);e==nil{t.Fatal("inventory token allowed record deletion")}
 if _,e=f.stores["purge"].DB.ExecContext(ctx,"SELECT public.c075_due('privacy-purge',33)");e==nil{t.Fatal("unbounded inventory scan")}
}

func TestC075ManagedProductionPrivacy(t *testing.T){
 f:=c075Setup(t);broker:=c073Setup(t);ctx:=f.base.ctx
 raw,_:=url.Parse(os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN"));var dbname string;f.base.admin.QueryRowContext(ctx,"SELECT current_database()").Scan(&dbname);raw.Path="/"+dbname;raw.User=url.UserPassword(f.roles["purge"],"c075-disposable-fixture")
 broker.mu.Lock();broker.dsn=raw.String();broker.mu.Unlock()
 store,e:=OpenC075ManagedPrivacy(ctx,broker.client,f.auth);if e!=nil{t.Fatal("managed restricted privacy open",e)};defer store.DB.Close()
 scan:=f.grant("scan",C075Ref{"JOB","retention-scan"},"",0);if _,e=store.Due(ctx,scan);e!=nil{t.Fatal(e)}
 broker.mu.Lock();broker.mode="outage";broker.mu.Unlock();if _,e=store.Due(ctx,scan);e==nil{t.Fatal("cached managed identity admitted")}
 broker.mu.Lock();broker.mode="";broker.mu.Unlock();if _,e=store.Due(ctx,scan);e!=nil{t.Fatal("managed identity recovery",e)}
 if _,e=store.DB.ExecContext(ctx,"DELETE FROM compliance_durable_jobs");e==nil{t.Fatal("privacy worker has broad DELETE")}
 store.DB.Close();if _,e=store.Due(ctx,scan);e==nil{t.Fatal("database outage inventory fallback")}
}
