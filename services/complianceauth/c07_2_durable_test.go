package complianceauth
import("context";"crypto/ed25519";"crypto/rand";"database/sql";"encoding/json";"net/url";"os";"strconv";"strings";"sync";"sync/atomic";"testing";"time";"github.com/lib/pq")
type c072ApprovalProvider struct{key ed25519.PrivateKey;fail bool}
func(p c072ApprovalProvider)Approval(_ context.Context,old,next PublicationFence)(PublicationApproval,error){
 if p.fail{return PublicationApproval{},ErrUnauthorized};a:=PublicationApproval{KeyID:"review",ReviewerID:"legal-reviewer",PublisherID:"publisher",Before:old,After:next,ValidUntil:time.Now().UTC().Add(time.Minute)};b,_:=publicationApprovalBytes(a);a.Signature=ed25519.Sign(p.key,b);return a,nil
}
type c072Fixture struct{ctx context.Context;admin *sql.DB;a,b,other *ProductionPublicationRuntime;scope C064AuthorScope;control *PublicationControl;public ed25519.PublicKey;secret ed25519.PrivateKey;authority SignedIndependentPublicationAuthority;initial PublicationFence}
func c072Setup(t *testing.T)*c072Fixture{
 t.Helper();raw:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN");if raw==""{t.Fatal("C07.2 requires real PostgreSQL; never skip")}
 ctx,cancel:=context.WithTimeout(context.Background(),90*time.Second);t.Cleanup(cancel)
 root,e:=OpenPostgreSQLPublicationStore(raw);if e!=nil{t.Fatal(e)}
 suffix:=strconv.FormatInt(time.Now().UnixNano(),10);dbname:="c072_"+suffix;ra:="c072_a_"+suffix;rb:="c072_b_"+suffix
 if _,e=root.DB.ExecContext(ctx,"CREATE DATABASE "+pq.QuoteIdentifier(dbname));e!=nil{t.Fatal(e)}
 t.Cleanup(func(){root.DB.Exec("DROP DATABASE "+pq.QuoteIdentifier(dbname)+" WITH (FORCE)");root.DB.Exec("DROP ROLE IF EXISTS "+pq.QuoteIdentifier(ra));root.DB.Exec("DROP ROLE IF EXISTS "+pq.QuoteIdentifier(rb));root.DB.Close()})
 u,_:=url.Parse(raw);u.Path="/"+dbname;admin,e:=OpenPostgreSQLPublicationStore(u.String());if e!=nil{t.Fatal(e)};t.Cleanup(func(){admin.DB.Close()})
 cipher:=c071TestCipher(t);if e=MigrateC071Database(ctx,admin.DB,cipher);e!=nil{t.Fatal(e)}
 scope:=C064AuthorScope{Tenant:"tenant-a",Domain:"delivery",Jurisdiction:"BC"};otherScope:=scope;otherScope.Tenant="tenant-b";otherScope.Jurisdiction="ON"
 pubscope:=controlScope("production",scope.Domain,scope.Jurisdiction);otherPub:=controlScope("production",otherScope.Domain,otherScope.Jurisdiction)
 for _,r:=range []string{ra,rb}{if _,e=admin.DB.ExecContext(ctx,"CREATE ROLE "+pq.QuoteIdentifier(r)+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'c072-disposable-fixture'");e!=nil{t.Fatal(e)}}
 if e=BindC071RuntimeRole(ctx,admin.DB,ra,scope,pubscope);e!=nil{t.Fatal(e)};if e=BindC071RuntimeRole(ctx,admin.DB,rb,otherScope,otherPub);e!=nil{t.Fatal(e)}
 if BindC071RuntimeRole(ctx,admin.DB,rb,otherScope,pubscope)==nil{t.Fatal("shared publication scope crossed tenants")}
 reviewPub,reviewKey,_:=ed25519.GenerateKey(rand.Reader);authority:=SignedIndependentPublicationAuthority{TrustedReviewerKeys:map[string]ed25519.PublicKey{"review":reviewPub},Provider:c072ApprovalProvider{key:reviewKey},Clock:func()time.Time{return time.Now().UTC()}}
 makeRuntime:=func(role string,s C064AuthorScope,ps string)*ProductionPublicationRuntime{v:=*u;v.User=url.UserPassword(role,"c072-disposable-fixture");rt,e:=OpenC072ProductionRuntime(ctx,v.String(),s,ps,cipher,authority);if e!=nil{t.Fatal("restricted production open",e)};t.Cleanup(func(){rt.Close()});return rt}
 a:=makeRuntime(ra,scope,pubscope);b:=makeRuntime(ra,scope,pubscope);other:=makeRuntime(rb,otherScope,otherPub)
 now:=time.Now().UTC().Truncate(time.Microsecond);initial:=PublicationFence{Scope:pubscope,Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("initial")),DependencyDigest:Digest([]byte("dependency")),ExpiresAt:now.Add(time.Hour)}
 if ok,e:=admin.Bootstrap(ctx,initial);e!=nil||!ok{t.Fatal("bootstrap",e)}
 public,secret,_:=ed25519.GenerateKey(rand.Reader);control:=NewPublicationControl();if e=control.RegisterKey(PublicationKeyState{KeyID:"managed",Environment:"production",Domain:scope.Domain,Jurisdiction:scope.Jurisdiction,Audience:"DOOBr",PublicKey:public,NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)});e!=nil{t.Fatal(e)}
 return &c072Fixture{ctx,admin.DB,a,b,other,scope,control,public,secret,authority,initial}
}
func(f *c072Fixture)activation(t *testing.T,old PublicationFence,id string)C072Activation{
 t.Helper();now:=time.Now().UTC().Truncate(time.Microsecond);next:=old;next.Sequence++;next.PolicyDigest=Digest([]byte(id));next.ExpiresAt=now.Add(30*time.Minute)
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:next.PolicyDigest,ReviewDigest:Digest([]byte("legal-review")),Domain:f.scope.Domain,Jurisdiction:f.scope.Jurisdiction,Audience:"DOOBr",Environment:"production",KeyID:"managed",Sequence:next.Sequence,RevocationEpoch:next.RevocationEpoch,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 signed,e:=f.control.SignScheduledManifest(f.ctx,c048Signer{key:f.secret},m,now);if e!=nil{t.Fatal(e)}
 event,e:=SignComplianceImpact(ComplianceImpactEvent{EventID:id,Scope:next.Scope,Sequence:next.Sequence,PolicyDigest:next.PolicyDigest,RevocationEpoch:next.RevocationEpoch,Kind:"POLICY_CHANGED",IssuedAt:now,KeyID:"managed"},f.secret);if e!=nil{t.Fatal(e)}
 return C072Activation{Before:old,After:next,Signed:signed,ScheduledAt:now.Add(-time.Second),Event:event,Subscribers:[]string{"Travel","DOOBr"}}
}
func TestC072DurableJobsLeaseFencing(t *testing.T){
 f:=c072Setup(t);s:=f.a.Durable;s2:=f.b.Durable;ctx:=f.ctx
 var wins atomic.Int32;var mu sync.Mutex;var leader C072Leader;var wg sync.WaitGroup
 for i:=0;i<16;i++{wg.Add(1);go func(i int){defer wg.Done();l,e:=s2.AcquireLeader(ctx,"COLLECTION","worker-"+strconv.Itoa(i),time.Minute);if e==nil{wins.Add(1);mu.Lock();leader=l;mu.Unlock()}}(i)};wg.Wait();if wins.Load()!=1{t.Fatal("split leader",wins.Load())}
 if s.RenewLeader(ctx,leader,2*time.Minute)!=nil{t.Fatal("leader heartbeat")}
 due:=time.Now().UTC().Truncate(time.Microsecond).Add(-time.Second);payload:=map[string]string{"source":"official-source-fixture"}
 if e:=s.Enqueue(ctx,"collect-1","COLLECTION",payload,due,2);e!=nil{t.Fatal(e)};if e:=s2.Enqueue(ctx,"collect-1","COLLECTION",payload,due,2);e!=nil{t.Fatal("idempotent enqueue",e)}
 if s.Enqueue(ctx,"collect-1","COLLECTION",map[string]string{"source":"changed"},due,2)==nil{t.Fatal("job id rebound")}
 if s.Enqueue(ctx,"huge","COLLECTION",strings.Repeat("x",C071MaxPrivateBytes+1),due,2)==nil{t.Fatal("oversize queued")}
 var storedBytes,storedRows int64
 if f.admin.QueryRowContext(ctx,"SELECT stored_bytes,stored_rows FROM compliance_storage_usage WHERE tenant='tenant-a'").Scan(&storedBytes,&storedRows)!=nil{t.Fatal("quota counter missing")}
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_storage_usage SET stored_rows=100000 WHERE tenant='tenant-a'");e!=nil{t.Fatal(e)}
 if s.Enqueue(ctx,"quota-denied","COLLECTION",payload,due,2)==nil{t.Fatal("durable quota bypass")}
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_storage_usage SET stored_rows=$1 WHERE tenant='tenant-a'",storedRows);e!=nil{t.Fatal(e)}
 var job C072Job;wins.Store(0)
 for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();j,e:=s2.Claim(ctx,leader,"COLLECTION",time.Minute);if e==nil{wins.Add(1);mu.Lock();job=j;mu.Unlock()}}()};wg.Wait();if wins.Load()!=1{t.Fatal("multiple job claimants",wins.Load())}
 if s.RenewJob(ctx,leader,job,time.Minute)!=nil{t.Fatal("job heartbeat")}
 var encrypted string;if f.admin.QueryRowContext(ctx,"SELECT payload::text FROM compliance_durable_jobs WHERE id='collect-1'").Scan(&encrypted)!=nil||strings.Contains(encrypted,"official-source-fixture"){t.Fatal("plaintext durable payload")}
 if _,e:=s.DB.ExecContext(ctx,"UPDATE compliance_durable_jobs SET fingerprint=repeat('0',64) WHERE id='collect-1'");e==nil{t.Fatal("immutable job rewrite accepted")}
 var n int;if f.other.Durable.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_durable_jobs").Scan(&n)!=nil||n!=0{t.Fatal("unfiltered job tenant leak")}
 wrong:=*s;wrong.Scope=f.other.Durable.Scope;if wrong.Enqueue(ctx,"other-aad","COLLECTION",payload,due,2)!=nil{t.Fatal("fixture enqueue")};if _,e:=s.Claim(ctx,leader,"COLLECTION",time.Minute);e==nil{t.Fatal("cross-scope ciphertext accepted")}
 // Expire the fixture-owned lease/leader to simulate a dead process without sleeping.
 if _,e:=f.admin.ExecContext(ctx,"UPDATE compliance_job_leaders SET expires_at=clock_timestamp()-interval '1 second' WHERE name='COLLECTION'");e!=nil{t.Fatal(e)}
 next,e:=s2.AcquireLeader(ctx,"COLLECTION","replacement",time.Minute);if e!=nil||next.Token<=leader.Token{t.Fatal("takeover token",e)}
 if s.FinishJob(ctx,leader,job,true)==nil||s.RenewLeader(ctx,leader,time.Minute)==nil{t.Fatal("stale leader wrote")}
 if _,e=f.admin.ExecContext(ctx,"UPDATE compliance_durable_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id='collect-1'");e!=nil{t.Fatal(e)}
 // Corrupt test job is not due for this recovery claim.
 if _,e=f.admin.ExecContext(ctx,"UPDATE compliance_durable_jobs SET due_at=clock_timestamp()+interval '1 hour' WHERE id='other-aad'");e!=nil{t.Fatal(e)}
 recovered,e:=s2.Claim(ctx,next,"COLLECTION",time.Minute);if e!=nil||recovered.ID!=job.ID||recovered.Token<=job.Token||recovered.Attempts!=2{t.Fatal("durable recovery",e)}
 if s2.FinishJob(ctx,next,job,true)==nil{t.Fatal("stale job owner wrote")};if s2.FinishJob(ctx,next,recovered,false)!=nil{t.Fatal("dead-letter finish")}
 var state string;if f.admin.QueryRowContext(ctx,"SELECT state FROM compliance_durable_jobs WHERE id='collect-1'").Scan(&state)!=nil||state!="DEAD"{t.Fatal("attempt budget",state)}
 if e=s2.Enqueue(ctx,"run-collector","COLLECTION",payload,due,2);e!=nil{t.Fatal(e)};called:=false
 if e=s2.RunCollection(ctx,next,func(c context.Context,p json.RawMessage)error{called=true;return nil});e!=nil||!called{t.Fatal("worker execution",e)}
 if _,e=f.admin.ExecContext(ctx,"UPDATE compliance_job_leaders SET expires_at=clock_timestamp()-interval '1 second' WHERE name='COLLECTION'");e!=nil{t.Fatal(e)}
 if _,e=s2.Claim(ctx,next,"COLLECTION",time.Minute);e==nil{t.Fatal("expired heartbeat accepted")}
 cancelled,cancel:=context.WithCancel(ctx);cancel();if s.Enqueue(cancelled,"cancelled","COLLECTION",payload,due,1)==nil{t.Fatal("cancelled enqueue")}
 t.Log("PASS: 16-worker leader and claim races, encryption, immutable payload, tenant denial, heartbeats, crash takeover, stale fences, finite attempts, collection execution, cancellation")
}
func TestC072AtomicActivationOutboxAndHalt(t *testing.T){
 f:=c072Setup(t);ctx:=f.ctx;s:=f.a.Durable;s2:=f.b.Durable
 leader,e:=s.AcquireLeader(ctx,"ACTIVATION","activator",5*time.Minute);if e!=nil{t.Fatal(e)};a:=f.activation(t,f.initial,"event-two")
 session:=C066OperatorSession{SubjectID:"operator",SessionID:"session",Role:"publisher_operator",Scope:f.scope,ExpiresAt:time.Now().Add(time.Minute)}
 ops:=C066Operations{Sessions:c066SessionProvider{session:session},Runtime:f.a,Control:f.control};token:="independent-operator-session"
 if e=ops.QueueActivation(ctx,token,"activate-2",a);e!=nil{t.Fatal(e)};j,e:=s.Claim(ctx,leader,"ACTIVATION",time.Minute);if e!=nil{t.Fatal(e)}
 if s.FinishJob(ctx,leader,j,true)==nil{t.Fatal("activation bypassed transaction")};if f.a.Publish(ctx,a.Before,a.After,time.Now())==nil{t.Fatal("legacy production publish bypass")}
 denied:=f.authority;denied.Provider=c072ApprovalProvider{fail:true};if s.Activate(ctx,leader,j,a,denied,f.control,f.public)==nil{t.Fatal("reviewer outage bypass")}
 forged:=a;forged.Event.Signature=append([]byte(nil),a.Event.Signature...);forged.Event.Signature[0]^=1;if s.Activate(ctx,leader,j,forged,f.authority,f.control,f.public)==nil{t.Fatal("forged invalidation")}
 future:=a;future.ScheduledAt=time.Now().Add(time.Hour);if s.Activate(ctx,leader,j,future,f.authority,f.control,f.public)==nil{t.Fatal("early activation")}
 // Force fan-out insertion failure AFTER policy UPDATE. Entire transaction must roll back.
 if _,e=f.admin.ExecContext(ctx,"CREATE FUNCTION public.c072_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture outbox outage'; END $$; CREATE TRIGGER c072_fixture_reject BEFORE INSERT ON compliance_impact_outbox FOR EACH ROW EXECUTE FUNCTION public.c072_fixture_reject()");e!=nil{t.Fatal(e)}
 if s.Activate(ctx,leader,j,a,f.authority,f.control,f.public)==nil{t.Fatal("outbox failure accepted")}
 current,e:=s2.Load(ctx,f.initial.Scope);if e!=nil||current!=f.initial{t.Fatal("partial fence update",e)}
 var n int;if f.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_activations").Scan(&n)!=nil||n!=0{t.Fatal("partial receipt")}
 if _,e=f.admin.ExecContext(ctx,"DROP TRIGGER c072_fixture_reject ON compliance_impact_outbox; DROP FUNCTION public.c072_fixture_reject()");e!=nil{t.Fatal(e)}
 var wg sync.WaitGroup;var success atomic.Int32
 for i:=0;i<12;i++{wg.Add(1);go func(){defer wg.Done();if s2.Activate(ctx,leader,j,a,f.authority,f.control,f.public)==nil{success.Add(1)}}()};wg.Wait();if success.Load()!=12{t.Fatal("idempotent recovery",success.Load())}
 if f.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_activations").Scan(&n)!=nil||n!=1{t.Fatal("duplicate activation")}
 if f.admin.QueryRowContext(ctx,"SELECT count(*) FROM compliance_impact_outbox").Scan(&n)!=nil||n!=2{t.Fatal("atomic fanout",n)}
 if _,e=f.b.Current(ctx,f.initial,time.Now());e==nil{t.Fatal("stale instance authorized")};if _,e=f.b.Current(ctx,a.After,time.Now());e!=nil{t.Fatal("fresh instance",e)}
 altered:=a;altered.Subscribers=[]string{"attacker"};if s.Activate(ctx,leader,j,altered,f.authority,f.control,f.public)==nil{t.Fatal("idempotency key rebound")}
 // Second publication; old unacknowledged events fence successor delivery.
 second:=f.activation(t,a.After,"event-three");if e=s.Enqueue(ctx,"activate-3","ACTIVATION",second,second.ScheduledAt,10);e!=nil{t.Fatal(e)};j2,e:=s.Claim(ctx,leader,"ACTIVATION",time.Minute);if e!=nil{t.Fatal(e)}
 if e=s.Activate(ctx,leader,j2,second,f.authority,f.control,f.public);e!=nil{t.Fatal("second activation",e)}
 o:=C072Outbox{Store:s,Owner:"sender-a"};o2:=C072Outbox{Store:s2,Owner:"sender-b"}
 item,e:=o.LeaseImpact(ctx,time.Now());if e!=nil||item.Event.Sequence!=2{t.Fatal("oldest event",e)}
 peer,e:=o2.LeaseImpact(ctx,time.Now());if e!=nil||peer.Event.Sequence!=2||peer.Subscriber==item.Subscriber{t.Fatal("parallel independent subscriber",e)}
 if _,e=o2.LeaseImpact(ctx,time.Now());e==nil{t.Fatal("sequence overtook unacked lease")}
 if _,e=f.admin.ExecContext(ctx,"UPDATE compliance_impact_outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE event_id=$1 AND subscriber=$2",item.Event.EventID,item.Subscriber);e!=nil{t.Fatal(e)}
 retry,e:=o2.LeaseImpact(ctx,time.Now());if e!=nil||retry.LeaseToken<=item.LeaseToken||retry.Attempts!=1{t.Fatal("outbox crash recovery",e)}
 if o.FinishImpact(ctx,item,true,time.Now(),10)==nil{t.Fatal("stale delivery acknowledgement")}
 if e=o2.FinishImpact(ctx,retry,false,time.Now().Add(-time.Hour),10);e!=nil{t.Fatal(e)}
 if _,e=o.LeaseImpact(ctx,time.Now().Add(time.Hour));e==nil{t.Fatal("caller clock bypassed retry")}
 if e=o2.FinishImpact(ctx,peer,true,time.Now(),10);e!=nil{t.Fatal(e)}
 successor,e:=o.LeaseImpact(ctx,time.Now());if e!=nil||successor.Event.Sequence!=3||successor.Subscriber!=peer.Subscriber{t.Fatal("subscriber order",e)};if e=o.FinishImpact(ctx,successor,true,time.Now(),10);e!=nil{t.Fatal(e)}
 // Exercise retry exhaustion and prove dead-letter predecessors continue blocking.
 for attempt:=2;attempt<=10;attempt++{if _,e=f.admin.ExecContext(ctx,"UPDATE compliance_impact_outbox SET due_at=clock_timestamp()-interval '1 second' WHERE event_id=$1 AND subscriber=$2",item.Event.EventID,item.Subscriber);e!=nil{t.Fatal(e)};leased,e:=o.LeaseImpact(ctx,time.Now());if e!=nil||leased.Attempts!=uint32(attempt-1){t.Fatal("retry count",attempt,e)};if e=o.FinishImpact(ctx,leased,false,time.Now(),10);e!=nil{t.Fatal(e)}}
 if _,e=o.LeaseImpact(ctx,time.Now());e==nil{t.Fatal("dead-letter predecessor skipped")}
 if o.PublishImpact(ctx,a.Event,a.Subscribers)==nil{t.Fatal("standalone event injected")}
 if f.other.Durable.DB.QueryRowContext(ctx,"SELECT count(*) FROM compliance_impact_outbox").Scan(&n)!=nil||n!=0{t.Fatal("outbox tenant leak")}
 if _,e=s.DB.ExecContext(ctx,"DELETE FROM compliance_activations");e==nil{t.Fatal("activation history deleted")}
 // A separately queued stale activation cannot reuse the prior canonical fence.
 stale:=f.activation(t,a.After,"stale-event");if e=s.Enqueue(ctx,"stale-job","ACTIVATION",stale,stale.ScheduledAt,2);e!=nil{t.Fatal(e)};staleJob,e:=s.Claim(ctx,leader,"ACTIVATION",time.Minute);if e!=nil{t.Fatal(e)}
 if s.Activate(ctx,leader,staleJob,stale,f.authority,f.control,f.public)==nil{t.Fatal("competing old fence activated")}
 if s.FinishJob(ctx,leader,staleJob,false)!=nil{t.Fatal("failed activation reschedule")}
 // Authenticated durable halt survives a different runtime and reconnect.
 if e=ops.Halt(ctx,token,"production");e!=nil{t.Fatal("durable halt",e)};if e=ops.Halt(ctx,token,"production");e!=nil{t.Fatal("idempotent halt",e)}
 if _,e=f.b.Current(ctx,second.After,time.Now());e==nil{t.Fatal("other process ignored halt")}
 if s2.Activate(ctx,leader,j2,second,f.authority,f.control,f.public)==nil{t.Fatal("replay ignored durable halt")}
 if _,e=s.DB.ExecContext(ctx,"DELETE FROM compliance_durable_halts");e==nil{t.Fatal("runtime cleared halt")}
 unauthorized:=ops;session.Role="author";unauthorized.Sessions=c066SessionProvider{session:session};if unauthorized.Halt(ctx,token,"production")==nil{t.Fatal("author halted")}
 cancelled,cancel:=context.WithCancel(ctx);cancel();if _,e=f.b.Current(cancelled,second.After,time.Now());e==nil{t.Fatal("cancelled read")}
 var accountedBytes,accountedRows,actualBytes,actualRows int64
 if f.admin.QueryRowContext(ctx,"SELECT stored_bytes,stored_rows FROM compliance_storage_usage WHERE tenant='tenant-a'").Scan(&accountedBytes,&accountedRows)!=nil{t.Fatal("accounting row")}
 query:="SELECT sum(bytes),sum(rows) FROM (";for i,table:=range []string{"compliance_job_leaders","compliance_durable_jobs","compliance_durable_halts","compliance_activations","compliance_impact_outbox"}{if i>0{query+=" UNION ALL "};query+="SELECT coalesce(sum(octet_length(to_jsonb(v)::text)),0) bytes,count(*) rows FROM public."+table+" v WHERE scope=$1"};query+=") actual"
 if f.admin.QueryRowContext(ctx,query,s.PublicationScope).Scan(&actualBytes,&actualRows)!=nil||accountedBytes!=actualBytes||accountedRows!=actualRows{t.Fatal("durable accounting mismatch",accountedBytes,actualBytes,accountedRows,actualRows)}
 if e=f.b.Close();e!=nil{t.Fatal(e)};if _,e=f.b.Current(ctx,second.After,time.Now());e==nil{t.Fatal("database outage fallback")}
 t.Log("PASS: reviewer/signature/schedule denial, atomic rollback, 12-worker idempotent activation, stale-cache denial, per-subscriber order, lease recovery, retry/dead-letter, tenant isolation, authenticated durable halt, outage")
}
func TestC072Boundaries(t *testing.T){
 ctx:=context.Background();s:=&C072Store{};if _,e:=s.AcquireLeader(ctx,"COLLECTION","worker",time.Minute);e==nil{t.Fatal("nil database accepted")}
 if c072Duration(0)||c072Duration(6*time.Minute){t.Fatal("unbounded lease")};if strings.ContainsRune(controlScope("production","delivery","BC"),0)||!c051Scope(controlScope("production","delivery","BC")){t.Fatal("invalid PostgreSQL scope")}
 if controlScope("a","b/c","d")==controlScope("a","b","c/d"){t.Fatal("scope collision")}
}
