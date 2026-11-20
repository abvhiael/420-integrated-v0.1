//go:build account420_integration

package account

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/json"
 "errors"
 "os"
 "strings"
 "sync"
 "testing"
 "time"
)

func sessionDB(t *testing.T)*sql.DB{
 t.Helper()
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN");if dsn==""{t.Fatal("disposable PostgreSQL required")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};t.Cleanup(func(){db.Close()})
 var name string;if e=db.QueryRow("SELECT current_database()").Scan(&name);e!=nil||name!="account420_test"{t.Fatal("unsafe test database",e)}
 if e=Migrate(context.Background(),db);e!=nil{t.Fatal(e)}
 return db
}
func sessionAuth(t *testing.T,db *sql.DB,origin,rp string)(*Auth,*testMailer){
 t.Helper();s,e:=NewStore(db,[]string{"bong-goggles","doobtube"});if e!=nil{t.Fatal(e)}
 mail:=&testMailer{};a,e:=NewAuth(s,mail,origin,rp);if e!=nil{t.Fatal(e)};return a,mail
}
func sessionManager(t *testing.T,a *Auth,app string)*SessionManager{
 t.Helper();m,e:=NewSessionManager(a,app);if e!=nil{t.Fatal(e)};return m
}
func freshEmail(t *testing.T,a *Auth,mail *testMailer,email string)EmailResult{
 t.Helper();ctx:=context.Background()
 // Advance the test mailbox cooldown only in the disposable database.
 if _,e:=a.store.db.ExecContext(ctx,"UPDATE account420.email_throttle SET last_sent=clock_timestamp()-interval '2 minutes' WHERE email=$1",email);e!=nil{t.Fatal(e)}
 start,e:=a.BeginEmail(ctx,email);if e!=nil{t.Fatal(e)}
 result,e:=a.FinishEmail(ctx,start.ChallengeID,mail.secret);if e!=nil{t.Fatal(e)};return result
}
func mustIssueSession(t *testing.T,m *SessionManager,p Authentication)SessionGrant{
 t.Helper();g,e:=m.Issue(context.Background(),p);if e!=nil{t.Fatal(e)};return g
}
func deniedSession(t *testing.T,m *SessionManager,token string){
 t.Helper();if _,e:=m.Validate(context.Background(),token);!errors.Is(e,ErrAuthentication){t.Fatal("invalid session accepted",e)}
}
func TestSessionLifecycleAndCrossInstanceIsolation(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP);a2,_:=sessionAuth(t,db2,testOrigin,testRP)
 m:=sessionManager(t,a,"bong-goggles");m2:=sessionManager(t,a2,"bong-goggles");other:=sessionManager(t,a,"doobtube")
 rp2,_:=sessionAuth(t,db2,"https://other.example.org","other.example.org");wrongRP:=sessionManager(t,rp2,"bong-goggles")
 if _,e:=NewSessionManager(a,"unapproved");e==nil{t.Fatal("unapproved app")}
 if _,e:=m.Issue(ctx,Authentication{});!errors.Is(e,ErrAuthentication){t.Fatal("forged proof",e)}
 uid,_:=newID();email:=uid+"@example.org";p:=freshEmail(t,a,mail,email).Proof
 if _,e:=m2.Issue(ctx,p);!errors.Is(e,ErrAuthentication){t.Fatal("proof crosses server authority",e)}
 stale:=p;stale.issued=time.Now().Add(-6*time.Minute)
 if _,e:=m.Issue(ctx,stale);!errors.Is(e,ErrAuthentication){t.Fatal("expired proof",e)}
 // Exact proof can produce only one session even under simultaneous requests.
 grants:=make(chan SessionGrant,2);var wg sync.WaitGroup
 for i:=0;i<2;i++{wg.Add(1);go func(){defer wg.Done();g,e:=m.Issue(ctx,p);if e==nil{grants<-g}else if !errors.Is(e,ErrAuthentication){t.Errorf("issue race: %v",e)}}()}
 wg.Wait();close(grants);var g SessionGrant;n:=0;for v:=range grants{g=v;n++};if n!=1{t.Fatal("duplicate proof use",n)}
 if _,e:=other.Issue(ctx,p);!errors.Is(e,ErrAuthentication){t.Fatal("proof replay across app",e)}
 if g.Session.Subject.App!="bong-goggles"||g.Session.Method!="email"||!validID(g.Session.ID)||g.Session.ExpiresAt.Sub(g.Session.IssuedAt)!=7*24*time.Hour||g.Session.IdleUntil.Sub(g.Session.IssuedAt)!=24*time.Hour{t.Fatal("session policy mismatch",g.Session)}
 raw,e:=json.Marshal(g);if e!=nil||strings.Contains(string(raw),g.Token)||strings.Contains(string(raw),string(p.id)){t.Fatal("private identifiers serialized")}
 b,e:=decodeToken(g.Token);if e!=nil{t.Fatal(e)};sum:=sha256.Sum256(b);var stored []byte
 if e=db.QueryRow("SELECT token_digest FROM account420.sessions WHERE id=$1",g.Session.ID).Scan(&stored);e!=nil||string(stored)!=string(sum[:])||string(stored)==string(b){t.Fatal("bearer stored in plaintext",e)}
 if got,e:=m2.Validate(ctx,g.Token);e!=nil||got.Subject!=g.Session.Subject{t.Fatal("durability",e)}
 deniedSession(t,other,g.Token);deniedSession(t,wrongRP,g.Token);deniedSession(t,m,"invalid")
 // Exactly one renewal wins; the former bearer is no longer accepted.
 rotated:=make(chan SessionGrant,2)
 for _,svc:=range []*SessionManager{m,m2}{wg.Add(1);go func(s *SessionManager){defer wg.Done();r,e:=s.Renew(ctx,g.Token);if e==nil{rotated<-r}else if !errors.Is(e,ErrAuthentication){t.Errorf("renew race: %v",e)}}(svc)}
 wg.Wait();close(rotated);var renewed SessionGrant;n=0;for v:=range rotated{renewed=v;n++}
 if n!=1||renewed.Token==g.Token||renewed.Session.ID!=g.Session.ID||!renewed.Session.ExpiresAt.Equal(g.Session.ExpiresAt){t.Fatal("renewal replay or extended lifetime",n)}
 deniedSession(t,m,g.Token);deniedSession(t,m2,g.Token)
 extra:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof)
 cross:=mustIssueSession(t,other,freshEmail(t,a,mail,email).Proof)
 uid2,_:=newID();foreign:=mustIssueSession(t,m,freshEmail(t,a,mail,uid2+"@example.org").Proof)
 if extra.Session.Subject!=g.Session.Subject||cross.Session.Subject.ID==g.Session.Subject.ID{t.Fatal("non-stable or unscoped subject")}
 listed,e:=m2.List(ctx,renewed.Token);if e!=nil||len(listed)!=2{t.Fatal("list leaks or misses sessions",len(listed),e)}
 for _,target:=range []string{cross.Session.ID,foreign.Session.ID}{if e=m.Revoke(ctx,renewed.Token,target);!errors.Is(e,ErrAuthentication){t.Fatal("foreign session revoked",e)}}
 if e=m2.Revoke(ctx,renewed.Token,extra.Session.ID);e!=nil{t.Fatal(e)};deniedSession(t,m,extra.Token)
 if e=m2.RevokeAll(ctx,renewed.Token);e!=nil{t.Fatal(e)};deniedSession(t,m,renewed.Token)
 if _,e=other.Validate(ctx,cross.Token);e!=nil{t.Fatal("cross-app signout",e)}
 if _,e=m.Validate(ctx,foreign.Token);e!=nil{t.Fatal("foreign account signout",e)}
 // Absolute and idle expiry are independent; renewal cannot revive either.
 idle:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof)
 if _,e=db.Exec("UPDATE account420.sessions SET issued_at=clock_timestamp()-interval '2 days',idle_until=clock_timestamp()-interval '1 day' WHERE id=$1",idle.Session.ID);e!=nil{t.Fatal(e)}
 deniedSession(t,m,idle.Token);if _,e=m.Renew(ctx,idle.Token);!errors.Is(e,ErrAuthentication){t.Fatal("idle renewal",e)}
 hard:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof)
 if _,e=db.Exec("UPDATE account420.sessions SET expires_at=clock_timestamp()+interval '10 minutes',idle_until=clock_timestamp()+interval '5 minutes' WHERE id=$1",hard.Session.ID);e!=nil{t.Fatal(e)}
 bounded,e:=m.Renew(ctx,hard.Token);if e!=nil||!bounded.Session.IdleUntil.Equal(bounded.Session.ExpiresAt){t.Fatal("hard expiry limit",e)}
 if _,e=db.Exec("UPDATE account420.sessions SET issued_at=clock_timestamp()-interval '2 days',idle_until=clock_timestamp()-interval '1 day',expires_at=clock_timestamp()-interval '1 day' WHERE id=$1",hard.Session.ID);e!=nil{t.Fatal(e)}
 deniedSession(t,m,bounded.Token)
 current:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof);unspent:=freshEmail(t,a,mail,email).Proof
 if _,e=a.store.Transition(ctx,p.id,1,Suspended);e!=nil{t.Fatal(e)}
 deniedSession(t,m,current.Token);deniedSession(t,other,cross.Token)
 if _,e=a.store.Transition(ctx,p.id,2,Active);e!=nil{t.Fatal(e)}
 deniedSession(t,m,current.Token)
 if _,e=m.Issue(ctx,unspent);!errors.Is(e,ErrAuthentication){t.Fatal("stale proof after reactivation",e)}
 fresh:=mustIssueSession(t,m,freshEmail(t,a,mail,email).Proof)
 if e=m.Logout(ctx,fresh.Token);e!=nil{t.Fatal(e)};deniedSession(t,m2,fresh.Token)
 if e=m.PurgeExpired(ctx);e!=nil{t.Fatal(e)}
 deniedSession(t,m2,fresh.Token)
}

func TestRecoveryPreservesAccountAndRevokesPriorSessions(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t);a,mail:=sessionAuth(t,db,testOrigin,testRP);a2,_:=sessionAuth(t,db2,testOrigin,testRP)
 m:=sessionManager(t,a,"bong-goggles");m2:=sessionManager(t,a2,"bong-goggles");other:=sessionManager(t,a,"doobtube")
 uid,_:=newID();email:=uid+"@example.org";first:=freshEmail(t,a,mail,email)
 if first.Registration==nil{t.Fatal("initial registration absent")}
 decode:=func(s string)[]byte{t.Helper();b,e:=decodeToken(s);if e!=nil{t.Fatal(e)};return b}
 oldKey,oldCred:=testKey(t),mustRandom(t);handle:=decode(first.Registration.UserHandle)
 if e:=a.FinishPasskeyRegistration(ctx,first.Registration.ChallengeID,registration(t,oldKey,decode(first.Registration.Challenge),oldCred,0x4d));e!=nil{t.Fatal(e)}
 login,e:=a.BeginPasskeyLogin(ctx);if e!=nil{t.Fatal(e)}
 passProof,e:=a.FinishPasskeyLogin(ctx,login.ChallengeID,assertion(t,oldKey,decode(login.Challenge),oldCred,handle,0x0d,1,testOrigin,testRP));if e!=nil{t.Fatal(e)}
 if _,e=m.BeginRecovery(ctx,passProof,mustRandom(t));!errors.Is(e,ErrAuthentication){t.Fatal("recovery without email proof",e)}
 g:=mustIssueSession(t,m,passProof);cross:=mustIssueSession(t,other,freshEmail(t,a,mail,email).Proof)
 unused:=freshEmail(t,a,mail,email).Proof
 bind:=mustRandom(t);begin:=func()RegistrationOptions{t.Helper();p:=freshEmail(t,a,mail,email).Proof;opt,e:=m.BeginRecovery(ctx,p,bind);if e!=nil{t.Fatal(e)};if _,e=m.Issue(ctx,p);!errors.Is(e,ErrAuthentication){t.Fatal("recovery proof reusable",e)};return opt}
 opt:=begin();candidate:=testKey(t);cred:=mustRandom(t)
 if e=m2.FinishRecovery(ctx,opt.ChallengeID,mustRandom(t),registration(t,candidate,decode(opt.Challenge),cred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("wrong browser",e)}
 if e=other.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,candidate,decode(opt.Challenge),cred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("wrong app",e)}
 if e=m2.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,candidate,mustRandom(t),cred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("invalid replacement",e)}
 if _,e=m2.Validate(ctx,g.Token);e!=nil{t.Fatal("failed recovery invalidated old session",e)}
 if e=m2.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,candidate,decode(opt.Challenge),cred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("recovery replay",e)}
 opt=begin();if _,e=db.Exec("UPDATE account420.recovery_challenges SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",opt.ChallengeID);e!=nil{t.Fatal(e)}
 if e=m.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,candidate,decode(opt.Challenge),cred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("expired recovery",e)}
 opt=begin();if e=m.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,oldKey,decode(opt.Challenge),mustRandom(t),0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("same key recovery",e)}
 // A credential already in another account may not be substituted.
 uid2,_:=newID();foreignEmail:=uid2+"@example.org";foreign:=freshEmail(t,a,mail,foreignEmail)
 foreignCred:=mustRandom(t);foreignKey:=testKey(t)
 if e=a.FinishPasskeyRegistration(ctx,foreign.Registration.ChallengeID,registration(t,foreignKey,decode(foreign.Registration.Challenge),foreignCred,0x4d));e!=nil{t.Fatal(e)}
 opt=begin();if e=m.FinishRecovery(ctx,opt.ChallengeID,bind,registration(t,candidate,decode(opt.Challenge),foreignCred,0x4d));!errors.Is(e,ErrAuthentication){t.Fatal("duplicate credential replacement",e)}
 if _,e=m.Validate(ctx,g.Token);e!=nil{t.Fatal("duplicate credential rolled back incorrectly",e)}
 opt=begin();if _,e=db.Exec("UPDATE account420.email_throttle SET last_sent=clock_timestamp()-interval '2 minutes' WHERE email=$1",email);e!=nil{t.Fatal(e)}
 pending,e:=a.BeginEmail(ctx,email);if e!=nil{t.Fatal(e)};pendingSecret:=mail.secret
 // Two servers race the same replacement ceremony; only one can change it.
 response:=registration(t,candidate,decode(opt.Challenge),cred,0x4d)
 done:=make(chan bool,2);var wg sync.WaitGroup
 for _,svc:=range []*SessionManager{m,m2}{wg.Add(1);go func(s *SessionManager){defer wg.Done();err:=s.FinishRecovery(ctx,opt.ChallengeID,bind,response);if err==nil{done<-true}else if !errors.Is(err,ErrAuthentication){t.Errorf("recovery race: %v",err)}}(svc)}
 wg.Wait();close(done);wins:=0;for range done{wins++};if wins!=1{t.Fatal("recovery race",wins)}
 deniedSession(t,m,g.Token);deniedSession(t,other,cross.Token)
 if _,e=m.Issue(ctx,unused);!errors.Is(e,ErrAuthentication){t.Fatal("pre-recovery proof survived",e)}
 if _,e=a.FinishEmail(ctx,pending.ChallengeID,pendingSecret);!errors.Is(e,ErrAuthentication){t.Fatal("old email challenge survived",e)}
 login,e=a.BeginPasskeyLogin(ctx);if e!=nil{t.Fatal(e)}
 if _,e=a.FinishPasskeyLogin(ctx,login.ChallengeID,assertion(t,oldKey,decode(login.Challenge),oldCred,handle,0x0d,2,testOrigin,testRP));!errors.Is(e,ErrAuthentication){t.Fatal("old credential survived",e)}
 login,e=a2.BeginPasskeyLogin(ctx);if e!=nil{t.Fatal(e)}
 proof,e:=a2.FinishPasskeyLogin(ctx,login.ChallengeID,assertion(t,candidate,decode(login.Challenge),cred,handle,0x0d,1,testOrigin,testRP));if e!=nil||proof.id!=first.Proof.id||proof.revision!=2{t.Fatal("new credential did not preserve account",e)}
 replacement:=mustIssueSession(t,m2,proof);if replacement.Session.Subject!=g.Session.Subject{t.Fatal("recovery changed subject")}
}
