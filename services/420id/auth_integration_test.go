//go:build account420_integration

package account

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "encoding/json"
 "errors"
 "os"
 "sync"
 "strings"
 "testing"
)

func TestDurableEmailAndPasskey(t *testing.T){
 ctx:=context.Background()
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN");if dsn==""{t.Fatal("disposable PostgreSQL required")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db.Close()
 var name string;if e=db.QueryRowContext(ctx,"SELECT current_database()").Scan(&name);e!=nil||name!="account420_test"{t.Fatal("unsafe test database",e)}
 if e=Migrate(ctx,db);e!=nil{t.Fatal(e)};if e=Migrate(ctx,db);e!=nil{t.Fatal(e)}
 store,e:=NewStore(db,[]string{"bong-goggles","doobtube"});if e!=nil{t.Fatal(e)}
 mailer:=&testMailer{};auth,e:=NewAuth(store,mailer,testOrigin,testRP);if e!=nil{t.Fatal(e)}
 db2,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db2.Close()
 store2,e:=NewStore(db2,[]string{"bong-goggles"});if e!=nil{t.Fatal(e)}
 auth2,e:=NewAuth(store2,&testMailer{},testOrigin,testRP);if e!=nil{t.Fatal(e)}
 unique,e:=newID();if e!=nil{t.Fatal(e)};email:=unique+"@example.org"
 start,e:=auth.BeginEmail(ctx,email);if e!=nil||mailer.email!=email{t.Fatal(start,e)}
 secret:=mailer.secret;decoded,e:=decodeToken(secret);if e!=nil{t.Fatal(e)}
 var stored []byte;if e=db.QueryRowContext(ctx,"SELECT digest FROM account420.email_challenges WHERE id=$1",start.ChallengeID).Scan(&stored);e!=nil{t.Fatal(e)}
 want:=sha256.Sum256(decoded);if string(stored)!=string(want[:])||string(stored)==string(decoded){t.Fatal("not a digest")}
 if _,e=auth2.BeginEmail(ctx,email);!errors.Is(e,ErrUnavailable){t.Fatal("cooldown bypass",e)}
 if _,e=auth.FinishEmail(ctx,start.ChallengeID,encodeBytes(mustRandom(t)));!errors.Is(e,ErrAuthentication){t.Fatal("wrong code accepted",e)}
 // Multiple instances submitting the same valid email proof: exactly one wins.
 var wg sync.WaitGroup;results:=make(chan EmailResult,2)
 for _,svc:=range []*Auth{auth,auth2}{wg.Add(1);go func(a *Auth){defer wg.Done();r,e:=a.FinishEmail(ctx,start.ChallengeID,secret);if e==nil{results<-r}else if !errors.Is(e,ErrAuthentication){t.Errorf("unexpected error: %v",e)}}(svc)}
 wg.Wait();close(results)
 var result EmailResult;wins:=0;for r:=range results{result=r;wins++}
 if wins!=1||result.Proof.Method()!="email"||result.Registration==nil{t.Fatal("email ceremony did not converge",wins)}
 id:=result.Proof.AccountID();reg:=result.Registration
 body,_:=json.Marshal(result);if string(body)==""||containsAccount(body,string(id)){t.Fatal("internal identity exposed")}
 if _,e=auth2.FinishEmail(ctx,start.ChallengeID,secret);!errors.Is(e,ErrAuthentication){t.Fatal("email replay",e)}
 challenge,e:=decodeToken(reg.Challenge);if e!=nil{t.Fatal(e)};handle,e:=decodeToken(reg.UserHandle);if e!=nil{t.Fatal(e)}
 key,cred:=testKey(t),mustRandom(t);response:=registration(t,key,challenge,cred,0x4d)
 if e=auth2.FinishPasskeyRegistration(ctx,reg.ChallengeID,response);e!=nil{t.Fatal(e)}
 if e=auth.FinishPasskeyRegistration(ctx,reg.ChallengeID,response);!errors.Is(e,ErrAuthentication){t.Fatal("registration replay",e)}
 login:=func(s *Auth,flag byte,count uint32,who []byte)(LoginOptions,AssertionResponse){t.Helper();opt,e:=s.BeginPasskeyLogin(ctx);if e!=nil{t.Fatal(e)};c,e:=decodeToken(opt.Challenge);if e!=nil{t.Fatal(e)};return opt,assertion(t,key,c,cred,who,flag,count,testOrigin,testRP)}
 opt,as:=login(auth,0x0d,1,handle);proof,e:=auth2.FinishPasskeyLogin(ctx,opt.ChallengeID,as)
 if e!=nil||proof.AccountID()!=id||proof.Method()!="passkey"||proof.Revision()!=1{t.Fatal(proof,e)}
 if _,e=auth.FinishPasskeyLogin(ctx,opt.ChallengeID,as);!errors.Is(e,ErrAuthentication){t.Fatal("login replay",e)}
 opt,as=login(auth,0x0d,2,mustRandom(t));if _,e=auth2.FinishPasskeyLogin(ctx,opt.ChallengeID,as);!errors.Is(e,ErrAuthentication){t.Fatal("user handle substitution",e)}
 opt,as=login(auth,0x0d,1,handle);if _,e=auth2.FinishPasskeyLogin(ctx,opt.ChallengeID,as);!errors.Is(e,ErrAuthentication){t.Fatal("counter replay",e)}
 // A fresh email login resolves the existing account instead of making a new one.
 if _,e=db.ExecContext(ctx,"UPDATE account420.email_throttle SET last_sent=now()-interval '2 minutes' WHERE email=$1",email);e!=nil{t.Fatal(e)}
 again,e:=auth.BeginEmail(ctx,email);if e!=nil{t.Fatal(e)};againResult,e:=auth2.FinishEmail(ctx,again.ChallengeID,mailer.secret)
 if e!=nil||againResult.Proof.AccountID()!=id||againResult.Registration!=nil{t.Fatal("duplicate account or passkey enrollment",e)}
 if _,e=store.Transition(ctx,id,1,Suspended);e!=nil{t.Fatal(e)}
 opt,as=login(auth,0x0d,2,handle);if _,e=auth2.FinishPasskeyLogin(ctx,opt.ChallengeID,as);!errors.Is(e,ErrAuthentication){t.Fatal("suspended login",e)}
 if _,e=db.ExecContext(ctx,"UPDATE account420.email_throttle SET last_sent=now()-interval '2 minutes' WHERE email=$1",email);e!=nil{t.Fatal(e)}
 suspended,e:=auth.BeginEmail(ctx,email);if e!=nil{t.Fatal(e)}
 if _,e=auth.FinishEmail(ctx,suspended.ChallengeID,mailer.secret);!errors.Is(e,ErrAuthentication){t.Fatal("suspended email completed",e)}
 if _,e=store.Transition(ctx,id,2,Active);e!=nil{t.Fatal(e)}
 opt,as=login(auth,0x0d,2,handle)
 if _,e=db.ExecContext(ctx,"UPDATE account420.passkey_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",opt.ChallengeID);e!=nil{t.Fatal(e)}
 if _,e=auth2.FinishPasskeyLogin(ctx,opt.ChallengeID,as);!errors.Is(e,ErrAuthentication){t.Fatal("expired passkey challenge",e)}
 another:=unique+"+second@example.org";pending,e:=auth.BeginEmail(ctx,another);if e!=nil{t.Fatal(e)};secret=mailer.secret
 for i:=0;i<5;i++{if _,e=auth.FinishEmail(ctx,pending.ChallengeID,encodeBytes(mustRandom(t)));!errors.Is(e,ErrAuthentication){t.Fatal(e)}}
 if _,e=auth2.FinishEmail(ctx,pending.ChallengeID,secret);!errors.Is(e,ErrAuthentication){t.Fatal("attempt budget bypass",e)}
 if _,e=db.ExecContext(ctx,"UPDATE account420.email_throttle SET last_sent=now()-interval '2 minutes' WHERE email=$1",another);e!=nil{t.Fatal(e)}
 expired,e:=auth.BeginEmail(ctx,another);if e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"UPDATE account420.email_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",expired.ChallengeID);e!=nil{t.Fatal(e)}
 if _,e=auth.FinishEmail(ctx,expired.ChallengeID,mailer.secret);!errors.Is(e,ErrAuthentication){t.Fatal("expired email",e)}
 mailer.fail=true;if _,e=auth.BeginEmail(ctx,unique+"+failed@example.org");!errors.Is(e,ErrUnavailable){t.Fatal("relay failure leaked or accepted",e)}
 if e=auth.PurgeExpired(ctx);e!=nil{t.Fatal(e)}
 var n int;if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.passkey_challenges WHERE id=$1",opt.ChallengeID).Scan(&n);e!=nil||n!=0{t.Fatal("purge failed",n,e)}
}
func containsAccount(raw []byte,id string)bool{
 var decoded map[string]any;if json.Unmarshal(raw,&decoded)!=nil{return true}
 _,has:=decoded["Proof"];return has||strings.Contains(string(raw),id)||id==""
}
