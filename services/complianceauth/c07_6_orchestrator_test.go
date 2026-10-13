package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "testing"
 "time"
)
type c076WitnessFixture struct { w C076Witness; err error }
func (a c076WitnessFixture) RecoverWitness(context.Context,string)(C076Witness,error){return a.w,a.err}
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
  e:=C076Restore(context.Background(),plan,c076WitnessFixture{w:w},p,now)
  if (e==nil)!=expectPass{t.Fatalf("failure %q pass=%v expected=%v calls=%v",fail,e==nil,expectPass,p.calls)}
  if !expectPass&&!p.closed{t.Fatalf("failed restore opened service: %v",p.calls)}
  if expectPass&&p.closed{t.Fatal("successful release remained closed")}
 }
 run("",witness,true)
 for _,point:=range []string{"quiesce","backup","replay","fence","leases","snapshot","release"}{t.Run(point,func(t *testing.T){run(point,witness,false)})}
 stale:=witness;stale.Checkpoint.Fence.Sequence--
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
