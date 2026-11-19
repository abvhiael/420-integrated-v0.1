// Package treasuryread validates derived Indexer responses, never settlement authority.
package treasuryread

import (
 "encoding/json"
 "errors"
 "math/big"
 "regexp"
 "strconv"
 "strings"
)

var ErrWrongChain = errors.New("420Indexer wrong chain")
var ErrAuthority = errors.New("420Indexer claimed canonical authority")
var ErrInvalid = errors.New("invalid derived Treasury response")
var hash = regexp.MustCompile("^0x[0-9a-fA-F]{64}$")
var addr = regexp.MustCompile("^0x[0-9a-fA-F]{40}$")
var decimal = regexp.MustCompile("^(0|[1-9][0-9]*)$")

func number(s string, bits int) (*big.Int,bool) {
 if !decimal.MatchString(s) { return nil,false }
 n,ok:=new(big.Int).SetString(s,10)
 return n,ok && n.BitLen()<=bits
}

type Provenance struct {
 ChainID string `json:"chainId"`
 BlockNumber string `json:"blockNumber"`
 BlockHash string `json:"blockHash"`
 TransactionHash string `json:"transactionHash"`
 TransactionIndex *uint64 `json:"transactionIndex"`
 LogIndex *uint64 `json:"logIndex"`
 Authoritative *bool `json:"authoritative"`
}

func Validate(data json.RawMessage, chain uint64, kind, id string) error {
 var p Provenance
 if json.Unmarshal(data,&p)!=nil { return ErrInvalid }
 if p.ChainID!=strconv.FormatUint(chain,10) || chain==0 { return ErrWrongChain }
 if p.Authoritative!=nil && *p.Authoritative { return ErrAuthority }
 if p.Authoritative==nil || !hash.MatchString(p.BlockHash) || !hash.MatchString(p.TransactionHash) || p.TransactionIndex==nil || p.LogIndex==nil { return ErrInvalid }
 if _,ok:=number(p.BlockNumber,256); !ok { return ErrInvalid }
 var v struct {
  BudgetID string `json:"budgetId"`
  DisbursementID string `json:"disbursementId"`
  Asset string `json:"asset"`
  Ceiling string `json:"ceiling"`
  Committed string `json:"committed"`
  Executed string `json:"executed"`
  Amount string `json:"amount"`
  State string `json:"state"`
  VaultReleaseHash *string `json:"vaultReleaseHash"`
  Executor *string `json:"executor"`
  Allowed *bool `json:"allowed"`
  MaxSingle string `json:"maxSingleDisbursement"`
  MaxEpoch string `json:"maxEpochDisbursement"`
  EpochSeconds string `json:"epochSeconds"`
  Revision string `json:"revision"`
 }
 if json.Unmarshal(data,&v)!=nil || !addr.MatchString(v.Asset) { return ErrInvalid }
 switch kind {
 case "budgets":
  a,ok1:=number(v.Ceiling,128); b,ok2:=number(v.Committed,128); c,ok3:=number(v.Executed,128)
  if !hash.MatchString(v.BudgetID)||!strings.EqualFold(v.BudgetID,id)||!ok1||!ok2||!ok3||a.Sign()==0||b.Cmp(a)>0||c.Cmp(b)>0 { return ErrInvalid }
 case "disbursements":
  a,ok:=number(v.Amount,128)
  if !hash.MatchString(v.DisbursementID)||!strings.EqualFold(v.DisbursementID,id)||!hash.MatchString(v.BudgetID)||!ok||a.Sign()==0 { return ErrInvalid }
  switch v.State {
  case "EXECUTED":
   if v.VaultReleaseHash==nil||!hash.MatchString(*v.VaultReleaseHash)||strings.EqualFold(*v.VaultReleaseHash,"0x"+strings.Repeat("0",64))||v.Executor==nil||!addr.MatchString(*v.Executor)||strings.EqualFold(*v.Executor,"0x"+strings.Repeat("0",40)){return ErrInvalid}
  case "SCHEDULED","CANCELLED":
   if v.VaultReleaseHash!=nil||v.Executor!=nil{return ErrInvalid}
  default:return ErrInvalid
  }
 case "asset-policies":
  a,ok1:=number(v.MaxSingle,128); b,ok2:=number(v.MaxEpoch,128); c,ok3:=number(v.EpochSeconds,64); d,ok4:=number(v.Revision,32)
  if !strings.EqualFold(v.Asset,id)||v.Allowed==nil||!ok1||!ok2||!ok3||!ok4||a.Sign()==0||b.Cmp(a)<0||c.Sign()==0||d.Sign()==0{return ErrInvalid}
 default:return ErrInvalid
 }
 return nil
}
