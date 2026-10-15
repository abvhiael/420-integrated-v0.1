package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "database/sql"
 "os"
 "testing"
 "time"
)
func TestC076ExternalPostgreSQLMonotonicJournal(t *testing.T){
 dsn:=os.Getenv("COMPLIANCE_POSTGRES_TEST_DSN")
 if dsn==""{t.Fatal("C07.6 mandatory PostgreSQL fixture missing")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db.Close()
 ctx,cancel:=context.WithTimeout(context.Background(),30*time.Second);defer cancel()
 if _,e=db.ExecContext(ctx,C076ExternalAuthoritySQL);e!=nil{t.Fatal(e)}
 scope:="c076-fixture-"+time.Now().UTC().Format("150405.000000000")
 t.Cleanup(func(){db.Exec("DELETE FROM public.c076_deletion_journal WHERE scope=$1",scope);db.Exec("DELETE FROM public.c076_authority WHERE scope=$1",scope)})
 pub,key,e:=ed25519.GenerateKey(rand.Reader);if e!=nil{t.Fatal(e)}
 mk:=func(g,seq,epoch,count uint64,digest string)C076SignedCheckpoint{
  cp:=C076Checkpoint{Scope:scope,Generation:g,Fence:PublicationFence{Scope:scope,Sequence:seq,RevocationEpoch:epoch,PolicyDigest:Digest([]byte("policy")),DependencyDigest:Digest([]byte("dependencies")),ExpiresAt:time.Now().Add(time.Hour)},PrivacyReceiptsCount:count,PrivacyReceiptsDigest:digest}
  cp.Fence.ExpiresAt=time.Date(2030,1,1,0,0,0,0,time.UTC)
  s:=C076SignedCheckpoint{Checkpoint:cp,Issuer:"fixture"};s.Signature=ed25519.Sign(key,c076SignedBytes(s));return s
 }
 empty:=Digest([]byte{})
 base:=mk(1,1,1,0,empty)
 raw,_:=encodeC076Checkpoint(base)
 if _,e=db.ExecContext(ctx,`INSERT INTO public.c076_authority(scope,generation,sequence,revocation_epoch,receipt_count,signed_checkpoint) VALUES($1,1,1,1,0,$2)`,scope,raw);e!=nil{t.Fatal(e)}
 b:=&C076ExternalPostgres{DB:db,IssuerKeys:map[string]ed25519.PublicKey{"fixture":pub}}
 if signed,e:=b.ReadSigned(ctx,scope);e!=nil||signed.Checkpoint!=base.Checkpoint{t.Fatal("signed independent read",e)}
 newDigest:=Digest([]byte("JOB:erased\x00"))
 next:=mk(2,2,2,1,newDigest)
 if e=b.AdvanceSignedCheckpoint(ctx,base,next,[]C076Deletion{{Kind:"JOB",Ref:"erased"}});e!=nil{t.Fatal("monotonic advance",e)}
 w,e:=b.ReadWitness(ctx,scope);if e!=nil||len(w.Deletions)!=1||w.Checkpoint!=next.Checkpoint{t.Fatal("journal and checkpoint mismatch",e)}
 if e=b.AdvanceSignedCheckpoint(ctx,base,next,[]C076Deletion{{Kind:"JOB",Ref:"erased"}});e==nil{t.Fatal("stale CAS succeeded")}
 rollback:=mk(3,1,1,1,newDigest)
 if e=b.AdvanceSignedCheckpoint(ctx,next,rollback,nil);e==nil{t.Fatal("publication/revocation rollback succeeded")}
 mismatched:=mk(3,3,3,1,Digest([]byte("wrong")))
 if e=b.AdvanceSignedCheckpoint(ctx,next,mismatched,nil);e==nil{t.Fatal("journal commitment mismatch accepted")}
 invoked:=false
 if e=b.WithCurrent(ctx,base.Checkpoint,func(context.Context)error{invoked=true;return nil});e==nil||invoked{t.Fatal("stale release callback executed")}
 if e=b.WithCurrent(ctx,next.Checkpoint,func(context.Context)error{invoked=true;return nil});e!=nil||!invoked{t.Fatal("current release denied",e)}
 if ok,e:=b.CanServe(ctx,scope,3);e!=nil||!ok{t.Fatal("committed independent release gate denied",e)}
 if ok,e:=b.CanServe(ctx,scope,2);e==nil||ok{t.Fatal("old generation served")}
 third:=mk(3,3,3,1,newDigest)
 if e=b.AdvanceSignedCheckpoint(ctx,next,third,nil);e!=nil{t.Fatal("revocation update",e)}
 if ok,e:=b.CanServe(ctx,scope,3);e==nil||ok{t.Fatal("superseded generation served after revocation")}

}
