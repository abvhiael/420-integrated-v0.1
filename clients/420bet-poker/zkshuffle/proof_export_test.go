package shuffle

import (
 "encoding/json"
 "fmt"
 "math/big"
 "os"
 "path/filepath"
 "testing"
 "github.com/consensys/gnark/backend/groth16"
 "github.com/consensys/gnark/frontend"
)

// Produces a real, exact-setup Solidity verifier and proof fixture. These are
// reproducible evidence artifacts, NOT a production trusted-setup ceremony.
func exportTestGroth16Solidity(t *testing.T, label string,
 vk groth16.VerifyingKey,proof groth16.Proof, public ...frontend.Variable) {
 t.Helper()
 dir:=os.Getenv("POKER_ZK_ARTIFACT_DIR");if dir=="" {return}
 if err:=os.MkdirAll(dir,0755);err!=nil{t.Fatal(err)}
 write:=func(suffix string, emit func(*os.File)error) {
  t.Helper()
  name:="EXPERIMENTAL-"+label+suffix
  file,err:=os.Create(filepath.Join(dir,name));if err!=nil{t.Fatal(err)}
  if err:=emit(file);err!=nil{file.Close();t.Fatal(err)}
  if err:=file.Close();err!=nil{t.Fatal(err)}
 }
 write("Verifier.sol",func(f *os.File)error{return vk.ExportSolidity(f)})
 write("VK.bin",func(f *os.File)error{_,err:=vk.WriteTo(f);return err})
 write("Proof.bin",func(f *os.File)error{_,err:=proof.WriteTo(f);return err})
 ps,ok:=proof.(interface{MarshalSolidity()[]byte});if !ok{t.Fatal("no BN254 Solidity proof encoder")}
 var inputs []string
 for _,field:=range public {
  if n,ok:=field.(*big.Int);ok {inputs=append(inputs,n.String())} else {inputs=append(inputs,fmt.Sprint(field))}
 }
 data,err:=json.Marshal(struct{Proof string `json:"proof"`;Public []string `json:"public"`}{
  Proof:fmt.Sprintf("0x%x",ps.MarshalSolidity()),Public:inputs,
 })
 if err!=nil{t.Fatal(err)}
 write("SolidityFixture.json",func(f *os.File)error{_,err:=f.Write(append(data,'\n'));return err})
}
