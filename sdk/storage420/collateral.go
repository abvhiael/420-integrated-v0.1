package storage420

import (
 "context"
 "crypto/rand"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "math/big"
 "strings"

 "github.com/420integrated/420-integrated/execution/storage"
)

// CollateralRPC is a read/simulation-only JSON-RPC boundary. It deliberately
// exposes no signing or broadcast method. Block references use EIP-1898.
type CollateralRPC interface {
 Call(context.Context, string, []any, any) error
}

type CollateralClient struct {
 RPC CollateralRPC
 ChainID string // canonical hex quantity
 GenesisHash string
 RegistryCodeHash string // trusted deployment identity, not supplied by RPC
}
const collateralRegistry = "0x0000000000000000000000000000000000000434"
var ErrCollateralAuthority = errors.New("resource collateral authority unavailable or invalid")

type CollateralSnapshot struct {
 ChainID, GenesisHash, BlockHash, Router, ProviderRegistry, Authority string
 client CollateralClient
}
type CollateralPosition struct {
 ID, ProviderID, Owner string
 Deposited, Slashable, Withdrawn, Slashed, Exposure, Reservations, PenaltyHolds *big.Int
 TrancheCount, WithdrawableAt uint64
 State uint8
 ExitPolicyRevision uint32
 CanWithdraw bool
}
type CollateralPolicy struct {
 Revision uint32
 MinimumCollateral, MinimumSlashable *big.Int
 WithdrawalDelay uint64
 CoverageBPS uint32
 AcceptingNew, AdmissionSuspended bool
 EvidenceHash, Commitment string
}
type ProviderCollateralStatus struct {
 Operator, StakeRef, Sponsor, DisciplineEvidence string
 Revision uint32
 DisciplineRevision uint64
 State uint8
 Exists, Active, Suspended, Disqualified bool
}
type CollateralReservation struct {
 Position, Controller string
 Exposure *big.Int
 PolicyRevision uint32
 Released bool
}
type CollateralPenalty struct {
 Position, Decision, Recipient string
 Amount, Executed *big.Int
 Resolved bool
}
type CollateralTransaction struct {
 ChainID, GenesisHash, BlockHash, From, To, Data, Value, DepositNonce string
}

func validWord(s string, n int) bool {
 if len(s)!=2+n*2 || !strings.HasPrefix(s,"0x") {return false}
 _,err:=hex.DecodeString(s[2:]);return err==nil
}
func nonzero(s string,n int)bool{return validWord(s,n)&&strings.Trim(s[2:],"0")!=""}
func same(a,b string)bool{return strings.EqualFold(a,b)}
func wordArg(s string,n int)(string,error){
 if !validWord(s,n){return "",ErrCollateralAuthority}
 return strings.Repeat("0",64-n*2)+strings.ToLower(s[2:]),nil
}
func uintArg(n uint64)string{return fmt.Sprintf("%064x",n)}
func calldata(sig string,args ...string)string{return storage.EventTopic(sig)[:10]+strings.Join(args,"")}
type collateralWords []string
func words(raw string,n int)(collateralWords,error){
 if !validWord(raw,n*32){return nil,ErrCollateralAuthority}
 out:=make(collateralWords,n);for i:=range out{out[i]=strings.ToLower(raw[2+i*64:2+(i+1)*64])};return out,nil
}
func (w collateralWords) hash(i int)string{return "0x"+w[i]}
func (w collateralWords) number(i int)*big.Int{n,_:=new(big.Int).SetString(w[i],16);return n}
func (w collateralWords) small(i,bits int)(uint64,error){n:=w.number(i);if n.BitLen()>bits{return 0,ErrCollateralAuthority};return n.Uint64(),nil}
func (w collateralWords) boolean(i int)(bool,error){n,e:=w.small(i,1);return n==1,e}
func (w collateralWords) address(i int)(string,error){if strings.Trim(w[i][:24],"0")!=""{return "",ErrCollateralAuthority};return "0x"+w[i][24:],nil}
func (s CollateralSnapshot) block()map[string]any{return map[string]any{"blockHash":s.BlockHash,"requireCanonical":true}}
func (s CollateralSnapshot) read(ctx context.Context,to,sig string,n int,args ...string)(collateralWords,error){
 var raw string
 if err:=s.client.RPC.Call(ctx,"eth_call",[]any{map[string]string{"to":to,"data":calldata(sig,args...)},s.block()},&raw);err!=nil{return nil,fmt.Errorf("%w: %v",ErrCollateralAuthority,err)}
 return words(raw,n)
}
func (s CollateralSnapshot) address(ctx context.Context,to,sig string)(string,error){
 w,e:=s.read(ctx,to,sig,1);if e!=nil{return "",e};a,e:=w.address(0);if e!=nil||!nonzero(a,20){return "",ErrCollateralAuthority};return a,nil
}
func (s CollateralSnapshot) codeHash(ctx context.Context,to string)(string,error){
 var raw string
 if e:=s.client.RPC.Call(ctx,"eth_getCode",[]any{to,s.block()},&raw);e!=nil{return "",e}
 if len(raw)<=2||!strings.HasPrefix(raw,"0x"){return "",ErrCollateralAuthority}
 b,e:=hex.DecodeString(raw[2:]);if e!=nil{return "",e};return storage.EventTopic(string(b)),nil
}
func (c CollateralClient) Snapshot(ctx context.Context)(CollateralSnapshot,error){
 fail:=func(e error)(CollateralSnapshot,error){return CollateralSnapshot{},fmt.Errorf("%w: %v",ErrCollateralAuthority,e)}
 if c.RPC==nil||!nonzero(c.GenesisHash,32)||!nonzero(c.RegistryCodeHash,32){return fail(ErrCollateralAuthority)}
 var chain string
 if e:=c.RPC.Call(ctx,"eth_chainId",nil,&chain);e!=nil||chain!=c.ChainID||chain==""{return fail(ErrCollateralAuthority)}
 type block struct{Hash string `json:"hash"`}
 var genesis,head block
 if e:=c.RPC.Call(ctx,"eth_getBlockByNumber",[]any{"0x0",false},&genesis);e!=nil||!same(genesis.Hash,c.GenesisHash){return fail(ErrCollateralAuthority)}
 if e:=c.RPC.Call(ctx,"eth_getBlockByNumber",[]any{"latest",false},&head);e!=nil||!nonzero(head.Hash,32){return fail(ErrCollateralAuthority)}
 s:=CollateralSnapshot{ChainID:chain,GenesisHash:genesis.Hash,BlockHash:head.Hash,client:c}
 h,e:=s.codeHash(ctx,collateralRegistry);if e!=nil||!same(h,c.RegistryCodeHash){return fail(ErrCollateralAuthority)}
 id:=storage.EventTopic("420/service/resource-protocol/v1")[2:]
 w,e:=s.read(ctx,collateralRegistry,"getService(bytes32)",6,id);if e!=nil{return fail(e)}
 active,e:=w.boolean(5);version,ve:=w.small(3,32);if e!=nil||ve!=nil||!active||version==0{return fail(ErrCollateralAuthority)}
 s.Router,e=w.address(0);if e!=nil||!nonzero(s.Router,20){return fail(ErrCollateralAuthority)}
 h,e=s.codeHash(ctx,s.Router);if e!=nil||!same(h,w.hash(1)){return fail(ErrCollateralAuthority)}
 profile,e:=s.read(ctx,collateralRegistry,"getRegistrationProfile(bytes32,uint32)",4,id,uintArg(version));if e!=nil{return fail(e)}
 kind,e:=profile.small(0,8);if e!=nil||kind!=3||!nonzero(profile.hash(1),32)||!nonzero(profile.hash(2),32)||!nonzero(profile.hash(3),32){return fail(ErrCollateralAuthority)}
 nodes,e:=s.address(ctx,s.Router,"nodes()");if e!=nil{return fail(e)}
 if _,e=s.codeHash(ctx,nodes);e!=nil{return fail(e)}
 s.ProviderRegistry,e=s.address(ctx,nodes,"providers()");if e!=nil{return fail(e)}
 if _,e=s.codeHash(ctx,s.ProviderRegistry);e!=nil{return fail(e)}
 s.Authority,e=s.address(ctx,s.ProviderRegistry,"collateral()");if e!=nil{return fail(e)}
 bound,e:=s.read(ctx,s.ProviderRegistry,"collateralCodeHash()",1);if e!=nil{return fail(e)}
 h,e=s.codeHash(ctx,s.Authority);if e!=nil||!same(h,bound.hash(0)){return fail(ErrCollateralAuthority)}
 back,e:=s.address(ctx,s.Authority,"providers()");if e!=nil||!same(back,s.ProviderRegistry){return fail(ErrCollateralAuthority)}
 return s,nil
}

// Every read is pinned to the same canonical block; failures return no partial
// authoritative result. Integer values are never converted through float64.
func (s CollateralSnapshot) Position(ctx context.Context,provider string)(p CollateralPosition,err error){
 a,e:=wordArg(provider,32);if e!=nil||!nonzero(provider,32){return p,ErrCollateralAuthority}
 w,e:=s.read(ctx,s.Authority,"positionId(bytes32)",1,a);if e!=nil{return p,e}
 id:=w.hash(0);a=w[0]
 w,e=s.read(ctx,s.Authority,"getPosition(bytes32)",6,a);if e!=nil{return p,e}
 p.ID=id;p.ProviderID=w.hash(0);p.Owner,e=w.address(1);if e!=nil{return CollateralPosition{},e}
 p.Deposited=w.number(2);p.Slashable=w.number(3)
 p.TrancheCount,e=w.small(4,64);if e!=nil{return CollateralPosition{},e}
 state,e:=w.small(5,8);if e!=nil||state>4||state!=0&&(!same(p.ProviderID,provider)||!nonzero(p.Owner,20)){return CollateralPosition{},ErrCollateralAuthority};p.State=uint8(state)
 for _,item:=range []struct{sig string;dest **big.Int}{{"withdrawnAmount(bytes32)",&p.Withdrawn},{"slashedAmount(bytes32)",&p.Slashed},{"outstandingExposure(bytes32)",&p.Exposure},{"outstandingReservations(bytes32)",&p.Reservations},{"outstandingPenaltyHolds(bytes32)",&p.PenaltyHolds}}{
 w,e=s.read(ctx,s.Authority,item.sig,1,a);if e!=nil{return CollateralPosition{},e};*item.dest=w.number(0)}
 w,e=s.read(ctx,s.Authority,"withdrawableAt(bytes32)",1,a);if e!=nil{return CollateralPosition{},e};p.WithdrawableAt,e=w.small(0,64);if e!=nil{return CollateralPosition{},e}
 w,e=s.read(ctx,s.Authority,"exitPolicyRevision(bytes32)",1,a);if e!=nil{return CollateralPosition{},e};rev,e:=w.small(0,32);if e!=nil{return CollateralPosition{},e};p.ExitPolicyRevision=uint32(rev)
 w,e=s.read(ctx,s.Authority,"canWithdraw(bytes32)",1,a);if e!=nil{return CollateralPosition{},e};p.CanWithdraw,e=w.boolean(0);if e!=nil{return CollateralPosition{},e};return p,nil
}
func(s CollateralSnapshot) Policy(ctx context.Context)(p CollateralPolicy,err error){
 w,e:=s.read(ctx,s.ProviderRegistry,"collateralPolicyRevision()",1);if e!=nil{return p,e}
 rev,e:=w.small(0,32);if e!=nil{return p,e};p.Revision=uint32(rev)
 w,e=s.read(ctx,s.ProviderRegistry,"collateralPolicy(uint32)",6,uintArg(rev));if e!=nil{return CollateralPolicy{},e}
 p.MinimumCollateral=w.number(0);p.MinimumSlashable=w.number(1);p.WithdrawalDelay,e=w.small(2,64);if e!=nil{return CollateralPolicy{},e}
 cov,e:=w.small(3,32);if e!=nil{return CollateralPolicy{},e};p.CoverageBPS=uint32(cov);p.AcceptingNew,e=w.boolean(4);if e!=nil{return CollateralPolicy{},e};p.EvidenceHash=w.hash(5)
 w,e=s.read(ctx,s.ProviderRegistry,"collateralPolicyCommitment(uint32)",1,uintArg(rev));if e!=nil{return CollateralPolicy{},e};p.Commitment=w.hash(0)
 w,e=s.read(ctx,s.ProviderRegistry,"admissionSuspended()",1);if e!=nil{return CollateralPolicy{},e};p.AdmissionSuspended,e=w.boolean(0);if e!=nil{return CollateralPolicy{},e};return p,nil
}
func(s CollateralSnapshot) Provider(ctx context.Context,provider string)(p ProviderCollateralStatus,err error){
 a,e:=wordArg(provider,32);if e!=nil{return p,e}
 w,e:=s.read(ctx,s.ProviderRegistry,"getProvider(bytes32)",6,a);if e!=nil{return p,e}
 p.Operator,e=w.address(0);if e!=nil{return ProviderCollateralStatus{},e};p.StakeRef=w.hash(2);rev,e:=w.small(3,32);if e!=nil{return ProviderCollateralStatus{},e};p.Revision=uint32(rev)
 state,e:=w.small(4,8);if e!=nil||state>4{return ProviderCollateralStatus{},ErrCollateralAuthority};p.State=uint8(state);p.Exists,e=w.boolean(5);if e!=nil{return ProviderCollateralStatus{},e}
 for _,item:=range []struct{sig string;dest *bool}{{"isActive(bytes32)",&p.Active},{"disciplinarySuspension(bytes32)",&p.Suspended},{"permanentlyDisqualified(bytes32)",&p.Disqualified}}{
 w,e=s.read(ctx,s.ProviderRegistry,item.sig,1,a);if e!=nil{return ProviderCollateralStatus{},e};*item.dest,e=w.boolean(0);if e!=nil{return ProviderCollateralStatus{},e}}
 w,e=s.read(ctx,s.ProviderRegistry,"collateralSponsor(bytes32)",1,a);if e!=nil{return ProviderCollateralStatus{},e};p.Sponsor,e=w.address(0);if e!=nil{return ProviderCollateralStatus{},e}
 w,e=s.read(ctx,s.ProviderRegistry,"disciplineEvidence(bytes32)",1,a);if e!=nil{return ProviderCollateralStatus{},e};p.DisciplineEvidence=w.hash(0)
 w,e=s.read(ctx,s.ProviderRegistry,"disciplineRevision(bytes32)",1,a);if e!=nil{return ProviderCollateralStatus{},e};p.DisciplineRevision,e=w.small(0,64);if e!=nil{return ProviderCollateralStatus{},e};return p,nil
}
func(s CollateralSnapshot) Reservation(ctx context.Context,id string)(p CollateralReservation,err error){
 a,e:=wordArg(id,32);if e!=nil{return p,e};w,e:=s.read(ctx,s.Authority,"reservations(bytes32)",5,a);if e!=nil{return p,e}
 p.Position=w.hash(0);p.Controller,e=w.address(1);if e!=nil{return CollateralReservation{},e};p.Exposure=w.number(2);rev,e:=w.small(3,32);if e!=nil{return CollateralReservation{},e};p.PolicyRevision=uint32(rev);p.Released,e=w.boolean(4);if e!=nil{return CollateralReservation{},e};return p,nil
}
func(s CollateralSnapshot) Penalty(ctx context.Context,id string)(p CollateralPenalty,err error){
 a,e:=wordArg(id,32);if e!=nil{return p,e};w,e:=s.read(ctx,s.Authority,"penaltyHolds(bytes32)",3,a);if e!=nil{return p,e}
 p.Position=w.hash(0);p.Amount=w.number(1);p.Resolved,e=w.boolean(2);if e!=nil{return CollateralPenalty{},e}
 w,e=s.read(ctx,s.Authority,"penaltyDecision(bytes32)",1,a);if e!=nil{return CollateralPenalty{},e};p.Decision=w.hash(0)
 w,e=s.read(ctx,s.Authority,"penaltyRecipient(bytes32)",1,a);if e!=nil{return CollateralPenalty{},e};p.Recipient,e=w.address(0);if e!=nil{return CollateralPenalty{},e}
 w,e=s.read(ctx,s.Authority,"penaltyExecuted(bytes32)",1,a);if e!=nil{return CollateralPenalty{},e};p.Executed=w.number(0);return p,nil
}
func NewCollateralDepositNonce()(string,error){var b [32]byte;if _,e:=rand.Read(b[:]);e!=nil{return "",e};return "0x"+hex.EncodeToString(b[:]),nil}
func(c CollateralClient) prepare(ctx context.Context,from,sig string,value *big.Int,nonce string,args ...string)(CollateralTransaction,error){
 if !nonzero(from,20)||value==nil||value.Sign()<0||value.BitLen()>256{return CollateralTransaction{},ErrCollateralAuthority}
 s,e:=c.Snapshot(ctx);if e!=nil{return CollateralTransaction{},e}
 t:=CollateralTransaction{ChainID:s.ChainID,GenesisHash:s.GenesisHash,BlockHash:s.BlockHash,From:from,To:s.Authority,Data:calldata(sig,args...),Value:"0x"+value.Text(16),DepositNonce:nonce}
 var raw string
 e=c.RPC.Call(ctx,"eth_call",[]any{map[string]string{"from":t.From,"to":t.To,"data":t.Data,"value":t.Value},s.block()},&raw)
 if e!=nil{return CollateralTransaction{},fmt.Errorf("collateral simulation rejected: %w",e)}
 if nonce!="" {w,e:=words(raw,1);if e!=nil||!nonzero(w.hash(0),32){return CollateralTransaction{},ErrCollateralAuthority}} else if raw!="0x"{return CollateralTransaction{},ErrCollateralAuthority}
 return t,nil
}
func(c CollateralClient) PrepareDeposit(ctx context.Context,from,provider,nonce string,amount *big.Int)(CollateralTransaction,error){
 if !nonzero(provider,32)||!nonzero(nonce,32)||amount==nil||amount.Sign()<=0{return CollateralTransaction{},ErrCollateralAuthority}
 return c.prepare(ctx,from,"deposit(bytes32,bytes32)",amount,nonce,provider[2:],nonce[2:])
}
func(c CollateralClient) PrepareExit(ctx context.Context,from,id string)(CollateralTransaction,error){
 if !nonzero(id,32){return CollateralTransaction{},ErrCollateralAuthority};return c.prepare(ctx,from,"requestExit(bytes32)",new(big.Int),"",id[2:])
}
func(c CollateralClient) PrepareWithdrawal(ctx context.Context,from,id string)(CollateralTransaction,error){
 if !nonzero(id,32){return CollateralTransaction{},ErrCollateralAuthority};return c.prepare(ctx,from,"withdraw(bytes32)",new(big.Int),"",id[2:])
}

// JSONRPCAdapter permits an existing transport to supply raw JSON responses.
type JSONRPCAdapter func(context.Context,string,[]any)(json.RawMessage,error)
func(a JSONRPCAdapter) Call(ctx context.Context,method string,args []any,out any)error{
 if a==nil{return ErrCollateralAuthority};raw,e:=a(ctx,method,args);if e!=nil{return e};return json.Unmarshal(raw,out)
}
