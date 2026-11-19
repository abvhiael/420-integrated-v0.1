package store

import (
 "errors"
 "strings"

 "github.com/420integrated/420-integrated/indexer/model"
)

// TreasurySnapshot copies a coherent checkpoint-bounded event history while
// holding the same lock as ingestion/reorg persistence. Never serve an
// uncheckpointed bundle or mix records across fork transitions.
func (s *FileStore) TreasurySnapshot(chain uint64, genesisHash string, addresses []string)([]model.LogRecord,error){
 s.mu.Lock();defer s.mu.Unlock()
 if s.failed!=nil{return nil,s.failed}
 cp:=s.data.Checkpoint
 if cp==nil||cp.ChainID!=chain{return nil,errors.New("Treasury checkpoint unavailable or wrong chain")}
 genesis,gok:=s.data.Blocks[0];tip,tok:=s.data.Blocks[cp.IndexedHeight]
 if !gok||!tok||genesis.ChainID!=chain||genesis.Number!=0||!strings.EqualFold(genesis.Hash,genesisHash)||tip.ChainID!=chain||tip.Number!=cp.IndexedHeight||!strings.EqualFold(tip.Hash,cp.IndexedHash){return nil,errors.New("Treasury checkpoint/genesis mismatch")}
 allowed:=map[string]bool{};for _,a:=range addresses{allowed[strings.ToLower(a)]=true}
 var logs []model.LogRecord
 for _,l:=range s.data.Logs{
  if !allowed[strings.ToLower(l.Address)]||l.BlockNumber>cp.IndexedHeight{continue}
  b,bok:=s.data.Blocks[l.BlockNumber];tx,xok:=s.data.Transactions[strings.ToLower(l.TransactionHash)];receipt,rok:=s.data.Receipts[strings.ToLower(l.TransactionHash)]
  if l.ChainID!=chain||!bok||b.ChainID!=chain||b.Number!=l.BlockNumber||!strings.EqualFold(b.Hash,l.BlockHash)||
    !xok||tx.ChainID!=chain||tx.BlockNumber!=l.BlockNumber||!strings.EqualFold(tx.BlockHash,l.BlockHash)||!strings.EqualFold(tx.Hash,l.TransactionHash)||tx.Index!=l.TransactionIndex||
    !rok||receipt.Status!=1||receipt.ChainID!=chain||receipt.BlockNumber!=l.BlockNumber||!strings.EqualFold(receipt.BlockHash,l.BlockHash)||!strings.EqualFold(receipt.TransactionHash,l.TransactionHash)||receipt.TransactionIndex!=l.TransactionIndex{return nil,errors.New("Treasury event provenance mismatch")}
  l.Topics=append([]string(nil),l.Topics...);logs=append(logs,l)
 }
 return logs,nil
}
