package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "testing"
 "time"
)
type c076WitnessFixture struct { w C076Witness; current C076Checkpoint; err error; changeAtRelease bool }
func (a c076WitnessFixture) RecoverWitness(context.Context,string)(C076Witness,error){return a.w,a.err}
func (a c076WitnessFixture) LatestCheckpoint(context.Context,string)(C076Checkpoint,error){return a.current,a.err}
func (a c076WitnessFixture) ReleaseIfCurrent(ctx context.Context,expected C076Checkpoint,g uint64,p C076RecoveryPlatform)error{
 if a.err!=nil||a.current!=expected||a.changeAtRelease{return ErrC076UnsafeRestore}
 return p.Release(ctx,expected.Scope,g)
}
type c076PlatformFixture struct {
 fail string; calls []string; closed bool; state C076RestoredState; witness C076Witness
}
func(p *c076PlatformFixture) step(s string)error{p.calls=append(p.calls,s);if p.fail==s{return errors.New("injected outage")};return nil}
func(p *c076PlatformFixture) Quiesce(_ context.Context,_ string)error{p.closed=true;return p.step("quiesce")}
func(p *c076PlatformFixture) RestoreVerifiedBackup(_ context.Context,_ C076RestorePlan)error{return p.step("backup")}
func(p *c076PlatformFixture) ReplayDeletion(_ context.Context,_ string,_ C076Deletion)error{return p.step("replay")}
func(p *c076PlatformFixture) RestoreCurrentFence(_ context.Context,f PublicationFence)error{if err:=p.step("fence");err!=nil{return err};p.state.Fence=f;return nil}
func(p *c076PlatformFixture) FenceOldLeasesAndSessions(_ context.Context,_ string,g uint64)error{if err:=p.step("leases");err!=nil{return err};p.state.Generation=g;return nil}
func(p *c076PlatformFixture) Snapshot(_ context.Context,_ string)(C076RestoredState,error){
 if err:=p.step("snapshot");err!=nil{return C076RestoredState{},err}
 p.state.PrivacyReceiptsDigest=p.witness.Checkpoint.PrivacyReceiptsDigest
 p.state.PrivacyReceiptsCount=p.witness.Checkpoint.PrivacyReceiptsCount
 return p.state,nil
}
func(p *c076PlatformFixture) Release(_ context.Context,_ string,_ uint64)error{if err:=p.step("release");err!=nil{return err};p.closed=false;return nil}
func TestC076OrchestratorFailClosed(t *testing.T){
 now:=time.Now().UTC()
 scope:="production-bc-vancouver"
 f:=PublicationFence{Scope:scope,Sequence:12,RevocationEpoch:8,PolicyDigest:Digest([]byte("latest")),DependencyDigest:Digest([]byte("signed dependencies")),ExpiresAt:now.Add(time.Hour)}
 deletion:=C076Deletion{Kind:"JOB",Ref:"purged123"}
 h:=sha256.Sum256([]byte("JOB:purged123\x00"))
 witness:=C076Witness{Checkpoint:C076Checkpoint{Scope:scope,Generation:7,Fence:f,PrivacyReceiptsDigest:hex.EncodeToString(h[:]),PrivacyReceiptsCount:1},Deletions:[]C076Deletion{deletion}}
 plan:=C076RestorePlan{Scope:scope,BackupSHA256:Digest([]byte("backup")),CheckpointGeneration:7}
 run:=func(fail string,w C076Witness,expectPass bool){
  t.Helper();p:=&c076PlatformFixture{fail:fail,witness:w}
  e:=C076Restore(context.Background(),plan,c076WitnessFixture{w:w,current:witness.Checkpoint},p,now)
  if (e==nil)!=expectPass{t.Fatalf("failure %q pass=%v expected=%v calls=%v",fail,e==nil,expectPass,p.calls)}
  if !expectPass&&!p.closed{t.Fatalf("failed restore opened service: %v",p.calls)}
  if expectPass&&p.closed{t.Fatal("successful release remained closed")}
 }
 run("",witness,true)
 t.Run("revocation_between_read_and_release",func(t *testing.T){
  p:=&c076PlatformFixture{witness:witness}
  a:=c076WitnessFixture{w:witness,current:witness.Checkpoint,changeAtRelease:true}
  if C076Restore(context.Background(),plan,a,p,now)==nil||!p.closed{t.Fatalf("revocation race must retain isolation: %v",p.calls)}
  for _,call:=range p.calls{if call=="release"{t.Fatal("release occurred despite changed authority")}}
 })
 for _,point:=range []string{"quiesce","backup","replay","fence","leases","snapshot","release"}{t.Run(point,func(t *testing.T){run(point,witness,false)})}
 // A stale but internally well-formed witness MUST be denied against the
 // independent latest checkpoint, not compared only with itself.
 stale:=witness;stale.Checkpoint.Fence.Sequence--
 run("",stale,false)
 stale=witness;stale.Checkpoint.Fence.RevocationEpoch--
 run("",stale,false)
 stale=witness;stale.Checkpoint.Fence.PolicyDigest=Digest([]byte("previous-policy"))
 run("",stale,false)
 stale=witness;stale.Checkpoint.PrivacyReceiptsDigest=Digest([]byte("missing receipt"))
 run("",stale,false)
 stale=witness;stale.Checkpoint.PrivacyReceiptsCount=2
 run("",stale,false)
 stale=witness;stale.Deletions=[]C076Deletion{deletion,deletion};stale.Checkpoint.PrivacyReceiptsCount=2
 run("",stale,false)
 stale=witness;stale.Checkpoint.Generation=6
 run("",stale,false)
}
