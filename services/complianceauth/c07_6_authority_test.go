package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "errors"
 "testing"
)
type c076SignedBackend struct { current C076SignedCheckpoint; fail bool; changed bool; called bool }
func(b *c076SignedBackend) ReadSigned(context.Context,string)(C076SignedCheckpoint,error){if b.fail{return C076SignedCheckpoint{},errors.New("external outage")};return b.current,nil}
func(b *c076SignedBackend) WithCurrent(ctx context.Context,expected C076Checkpoint,fn func(context.Context)error)error{
 if b.fail||b.changed||b.current.Checkpoint!=expected{return ErrC076UnsafeRestore}
 b.called=true
 return fn(ctx)
}
func TestC076AuthenticatedAuthoritySignatureAndAtomicRelease(t *testing.T){
 public,private,e:=ed25519.GenerateKey(rand.Reader);if e!=nil{t.Fatal(e)}
 cp:=C076Checkpoint{Scope:"scope",Generation:9,Fence:PublicationFence{Scope:"scope",Sequence:7,RevocationEpoch:4},PrivacyReceiptsDigest:Digest([]byte("receipts")),PrivacyReceiptsCount:1}
 signed:=C076SignedCheckpoint{Checkpoint:cp,Issuer:"authority-one"}
 signed.Signature=ed25519.Sign(private,c076SignedBytes(signed))
 backend:=&c076SignedBackend{current:signed}
 a:=&C076AuthenticatedAuthority{Backend:backend,TrustedIssuers:map[string]ed25519.PublicKey{"authority-one":public}}
 if got,e:=a.LatestCheckpoint(context.Background(),"scope");e!=nil||got!=cp{t.Fatal("valid authority signature rejected",e)}
 p:=&c076PlatformFixture{closed:true}
 if e:=a.ReleaseIfCurrent(context.Background(),cp,10,p);e!=nil||p.closed||!backend.called{t.Fatal("serialized release failed",e)}
 backend.changed=true;backend.called=false;p.closed=true
 if a.ReleaseIfCurrent(context.Background(),cp,10,p)==nil||backend.called||!p.closed{t.Fatal("changed authority allowed release")}
 backend.changed=false
 signed.Checkpoint.Generation=8
 signed.Signature=ed25519.Sign(private,c076SignedBytes(signed))
 backend.current=signed
 if _,e:=a.LatestCheckpoint(context.Background(),"scope");e==nil{t.Fatal("signed rollback accepted in same process")}
 signed.Checkpoint.Generation=10
 signed.Signature=[]byte("forged")
 backend.current=signed
 if _,e:=a.LatestCheckpoint(context.Background(),"scope");e==nil{t.Fatal("forged signed checkpoint accepted")}
 backend.fail=true
 if _,e:=a.LatestCheckpoint(context.Background(),"scope");e==nil{t.Fatal("external outage accepted")}
}
