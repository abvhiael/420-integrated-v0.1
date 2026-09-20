// bundler-interop420 is a read-only operator wire/domain qualification runner.
// Example: go run ./bundler/cmd/bundler-interop420 -chain-id 420 -entry-point 0x... -endpoint https://a.example/rpc -endpoint https://b.example/rpc
package main

import (
 "context"
 "encoding/json"
 "flag"
 "fmt"
 "net/http"
 "os"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/bundler/interoperability"
)

type endpointFlags []string
func (f *endpointFlags) String() string{return strings.Join(*f,",")}
func (f *endpointFlags) Set(raw string)error{
 if strings.TrimSpace(raw)==""{return fmt.Errorf("endpoint cannot be blank")}
 *f=append(*f,raw)
 return nil
}

func run(args []string)(interoperability.DomainMatrix,error){
 fs:=flag.NewFlagSet("bundler-interop420",flag.ContinueOnError)
 fs.SetOutput(os.Stderr)
 var chain uint64
 var entry string
 var endpoints endpointFlags
 fs.Uint64Var(&chain,"chain-id",0,"expected nonzero chain ID")
 fs.StringVar(&entry,"entry-point","","expected EntryPoint address")
 fs.Var(&endpoints,"endpoint","operator JSON-RPC URL; repeat for multiple operators")
 if err:=fs.Parse(args);err!=nil{return interoperability.DomainMatrix{},err}
 if len(fs.Args())!=0{return interoperability.DomainMatrix{},fmt.Errorf("unexpected positional arguments")}
 if chain==0||entry==""||len(endpoints)==0{return interoperability.DomainMatrix{},fmt.Errorf("-chain-id, -entry-point and at least one -endpoint are required")}
 ctx,cancel:=context.WithTimeout(context.Background(),30*time.Second)
 defer cancel()
 probe:=interoperability.Probe{EntryPoint:entry,Client:&http.Client{Timeout:5*time.Second}}
 return probe.CheckOperatorsForChain(ctx,endpoints,chain)
}

func main(){
 matrix,err:=run(os.Args[1:])
 if err!=nil{fmt.Fprintln(os.Stderr,err);os.Exit(2)}
 encoder:=json.NewEncoder(os.Stdout)
 encoder.SetIndent("","  ")
 if err:=encoder.Encode(matrix);err!=nil{fmt.Fprintln(os.Stderr,err);os.Exit(2)}
 if !matrix.AllQualified{os.Exit(1)}
}
