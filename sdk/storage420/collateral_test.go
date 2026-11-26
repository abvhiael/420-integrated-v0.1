package storage420

import (
 "context"
 "encoding/json"
 "errors"
 "math/big"
 "strings"
 "testing"

 "github.com/420integrated/420-integrated/execution/storage"
)

func TestCollateralStrictABI(t *testing.T){
 max:=strings.Repeat("f",64)
 w,e:=words("0x"+max,1);if e!=nil||w.number(0).BitLen()!=256{t.Fatal("lost uint256 precision")}
 if _,e=w.small(0,64);e==nil{t.Fatal("accepted overflow")}
 if _,e=w.boolean(0);e==nil{t.Fatal("accepted noncanonical bool")}
 if _,e=w.address(0);e==nil{t.Fatal("accepted noncanonical address")}
 for _,raw:=range []string{"0x","0x"+max+"00","0x"+strings.Repeat("z",64)}{if _,e=words(raw,1);e==nil{t.Fatal("accepted malformed ABI")}}
}
func TestCollateralNonceAndInvalidTransactions(t *testing.T){
 a,e:=NewCollateralDepositNonce();if e!=nil||!nonzero(a,32){t.Fatal(a,e)}
 b,e:=NewCollateralDepositNonce();if e!=nil||a==b{t.Fatal("nonce collision")}
 c:=CollateralClient{}
 if _,e=c.PrepareDeposit(context.Background(),"0x"+strings.Repeat("1",40),a,b,new(big.Int));e==nil{t.Fatal("accepted zero deposit")}
 if _,e=c.PrepareDeposit(context.Background(),"0x"+strings.Repeat("1",40),a,b,new(big.Int).Lsh(big.NewInt(1),256));e==nil{t.Fatal("accepted overflow")}
}
func TestCollateralRPCIntegration(t *testing.T){
 ctx:=context.Background()
 hash:=func(n string)string{return "0x"+strings.Repeat(n,64)}
 addr:=func(n string)string{return "0x"+strings.Repeat(n,40)}
 genesis,block:=hash("1"),hash("2")
 router,nodes,providers,authority:=addr("3"),addr("4"),addr("5"),addr("6")
 owner,provider,position,nonce:=addr("7"),hash("8"),hash("9"),hash("a")
 code:="0x6000";codehash:=storage.EventTopic(string([]byte{0x60,0}))
 aw:=func(a string)string{return strings.Repeat("0",24)+a[2:]}
 answer:=func(w ...string)string{return "0x"+strings.Join(w,"")}
 zero:=uintArg(0);one:=uintArg(1)
 max:=strings.Repeat("f",64)
 reject:=false;wrongChain:=false;wrongCode:=false
 rpc:=JSONRPCAdapter(func(_ context.Context,method string,args []any)(json.RawMessage,error){
 var out any
 switch method{
 case "eth_chainId":out="0x420";if wrongChain{out="0x1"}
 case "eth_getBlockByNumber":h:=block;if args[0]=="0x0"{h=genesis};out=map[string]string{"hash":h}
 case "eth_getCode":
  if args[1].(map[string]any)["blockHash"]!=block{return nil,errors.New("unpinned code")}
  out=code;if wrongCode&&args[0]==authority{out="0x6001"}
 case "eth_call":
  ref:=args[1].(map[string]any);if ref["blockHash"]!=block||ref["requireCanonical"]!=true{return nil,errors.New("unpinned read")}
  tx:=args[0].(map[string]string);data:=tx["data"]
  if tx["from"]!=""{
   if reject{return nil,errors.New("execution reverted")}
   if tx["to"]!=authority||tx["from"]!=owner{return nil,errors.New("wrong transaction identity")}
   switch data{
   case calldata("deposit(bytes32,bytes32)",provider[2:],nonce[2:]):if tx["value"]!="0x"+max{return nil,errors.New("wrong value")};out=position
   case calldata("requestExit(bytes32)",position[2:]),calldata("withdraw(bytes32)",position[2:]):if tx["value"]!="0x0"{return nil,errors.New("wrong value")};out="0x"
   default:return nil,errors.New("wrong transaction")
   }
   break
  }
  switch tx["to"]+data[:10]{
  case collateralRegistry+calldata("getService(bytes32)"):out=answer(aw(router),codehash[2:],hash("b")[2:],one,one,one)
  case collateralRegistry+calldata("getRegistrationProfile(bytes32,uint32)"):out=answer(uintArg(3),hash("b")[2:],hash("c")[2:],hash("d")[2:])
  case router+calldata("nodes()"):out=answer(aw(nodes))
  case nodes+calldata("providers()"),authority+calldata("providers()"):out=answer(aw(providers))
  case providers+calldata("collateral()"):out=answer(aw(authority))
  case providers+calldata("collateralCodeHash()"):out=codehash
  case authority+calldata("positionId(bytes32)"):out=position
  case authority+calldata("getPosition(bytes32)"):out=answer(provider[2:],aw(owner),max,max,one,one)
  case authority+calldata("withdrawnAmount(bytes32)"),authority+calldata("slashedAmount(bytes32)"),authority+calldata("outstandingExposure(bytes32)"),authority+calldata("outstandingReservations(bytes32)"),authority+calldata("outstandingPenaltyHolds(bytes32)"),authority+calldata("withdrawableAt(bytes32)"),authority+calldata("exitPolicyRevision(bytes32)"),authority+calldata("canWithdraw(bytes32)"):out=answer(zero)
  case providers+calldata("collateralPolicyRevision()"):out=answer(one)
  case providers+calldata("collateralPolicy(uint32)"):out=answer(max,max,uintArg(3600),uintArg(10000),one,hash("b")[2:])
  case providers+calldata("collateralPolicyCommitment(uint32)"):out=hash("c")
  case providers+calldata("admissionSuspended()"):out=answer(zero)
  case providers+calldata("getProvider(bytes32)"):out=answer(aw(owner),hash("b")[2:],position[2:],one,uintArg(2),one)
  case providers+calldata("isActive(bytes32)"):out=answer(one)
  case providers+calldata("disciplinarySuspension(bytes32)"),providers+calldata("permanentlyDisqualified(bytes32)"),providers+calldata("disciplineEvidence(bytes32)"),providers+calldata("disciplineRevision(bytes32)"):out=answer(zero)
  case providers+calldata("collateralSponsor(bytes32)"):out=answer(aw(owner))
  case authority+calldata("reservations(bytes32)"):out=answer(position[2:],aw(owner),max,one,zero)
  case authority+calldata("penaltyHolds(bytes32)"):out=answer(position[2:],max,one)
  case authority+calldata("penaltyDecision(bytes32)"):out=hash("b")
  case authority+calldata("penaltyRecipient(bytes32)"):out=answer(aw(owner))
  case authority+calldata("penaltyExecuted(bytes32)"):out=answer(max)
  default:return nil,errors.New("unexpected call "+tx["to"]+" "+data)
  }
 default:return nil,errors.New("unexpected RPC method")
 }
 return json.Marshal(out)
 })
 c:=CollateralClient{RPC:rpc,ChainID:"0x420",GenesisHash:genesis,RegistryCodeHash:codehash}
 s,e:=c.Snapshot(ctx);if e!=nil||s.Authority!=authority{t.Fatal(s,e)}
 p,e:=s.Position(ctx,provider);if e!=nil||p.Deposited.BitLen()!=256||p.CanWithdraw{t.Fatal(p,e)}
 policy,e:=s.Policy(ctx);if e!=nil||policy.MinimumCollateral.BitLen()!=256||policy.WithdrawalDelay!=3600{t.Fatal(policy,e)}
 status,e:=s.Provider(ctx,provider);if e!=nil||!status.Active||status.Disqualified{t.Fatal(status,e)}
 reservation,e:=s.Reservation(ctx,position);if e!=nil||reservation.Exposure.BitLen()!=256{t.Fatal(reservation,e)}
 penalty,e:=s.Penalty(ctx,position);if e!=nil||!penalty.Resolved||penalty.Executed.BitLen()!=256{t.Fatal(penalty,e)}
 tx,e:=c.PrepareDeposit(ctx,owner,provider,nonce,p.Deposited);if e!=nil||tx.DepositNonce!=nonce||tx.ChainID!="0x420"{t.Fatal(tx,e)}
 if _,e=c.PrepareExit(ctx,owner,position);e!=nil{t.Fatal(e)}
 if _,e=c.PrepareWithdrawal(ctx,owner,position);e!=nil{t.Fatal(e)}
 reject=true;if _,e=c.PrepareWithdrawal(ctx,owner,position);e==nil{t.Fatal("accepted reverted transaction")}
 wrongChain=true;if _,e=c.Snapshot(ctx);e==nil{t.Fatal("accepted wrong chain")}
 wrongChain=false;wrongCode=true;if _,e=c.Snapshot(ctx);e==nil{t.Fatal("accepted wrong authority code")}
}
