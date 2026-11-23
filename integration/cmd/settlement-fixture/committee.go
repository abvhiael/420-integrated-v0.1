//go:build blst

package main

// This file provisions never-used, PUBLICLY DERIVABLE local qualification keys.
// It does not produce votes or QCs, and MUST NOT be linked into the keyless
// certified-producer. The 15 BLS secrets live only in the 15 signer subprocesses.
import (
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "strconv"
    "strings"

    "github.com/420integrated/420-integrated/consensus/signing"
    "github.com/420integrated/420-integrated/consensus/slashing"
    ct "github.com/420integrated/420-integrated/consensus/types"
)

func provisionProtectedCommittee(dir, genesis, timestamp string) {
    if genesis=="" {panic("real node420 genesis required for local committee provision")}
    hash,err:=ct.ParseRoot(genesis);if err!=nil {panic(err)}
    ts,err:=strconv.ParseUint(strings.TrimPrefix(timestamp,"0x"),16,64)
    if err!=nil {panic("real native Genesis timestamp required")}
    if err=os.Mkdir(dir,0700);err!=nil {panic("private fresh committee directory required: "+err.Error())}
    t,keys:=keys()
    for _,k:=range keys {defer k.Destroy()}
    t.Timestamp=ts
    t.LastRotation=2
    t.Execution.ChainID=420
    t.Execution.BlockHash=hash
    policies:=make([]signing.Policy,15)
    write:=func(path string,value any) {
        raw,e:=json.MarshalIndent(value,"","  ");if e!=nil {panic(e)}
        if e=os.WriteFile(path,append(raw,'\n'),0600);e!=nil {panic(e)}
    }
    for i:=0;i<15;i++ {
        seatDir:=filepath.Join(dir,fmt.Sprintf("seat-%02d",i))
        remote:=filepath.Join(seatDir,"signer")
        local:=filepath.Join(seatDir,"validator")
        for _,p:=range []string{seatDir,remote,local} {
            if e:=os.Mkdir(p,0700);e!=nil {panic(e)}
        }
        p:=signing.Policy{Identity:slashing.HistoryIdentity{
            ChainID:420,Genesis:t.Genesis.Root,ValidatorID:uint64(96+i),
            PublicKey:t.Members[i].PublicKey},ProtocolVersion:1,CommitteeRoot:t.CommitteeRoot,
            Seat:uint16(i)}
        if e:=p.Validate();e!=nil {panic(e)}
        policies[i]=p
        write(filepath.Join(remote,"policy.json"),p)
        write(filepath.Join(local,"policy.json"),p)
        seed:=sha256.Sum256([]byte(fmt.Sprintf("INSECURE-LOCAL-RECOVERY-KEY-%d",i)))
        if e:=os.WriteFile(filepath.Join(remote,"bls.hex"),[]byte(hex.EncodeToString(seed[:])),0600);e!=nil {panic(e)}
        if e:=slashing.InitializeHistory(filepath.Join(local,"history.json"),p.Identity);e!=nil {panic(e)}
    }
    write(filepath.Join(dir,"trust.json"),t)
    write(filepath.Join(dir,"policies.json"),policies)
    fmt.Printf("GOV_PRE_08_15_PUBLIC_TEST_ONLY_INDEPENDENT_SIGNER_POLICIES_PROVISIONED=%d\n",len(policies))
}
