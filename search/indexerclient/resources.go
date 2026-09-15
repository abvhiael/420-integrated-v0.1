package indexerclient

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
)

type Block struct {
	ChainID    string `json:"chainId"`
	Number     string `json:"number"`
	Hash       string `json:"hash"`
	ParentHash string `json:"parentHash"`
	Timestamp  string `json:"timestamp"`
}

type Transaction struct {
	ChainID          string  `json:"chainId"`
	Hash             string  `json:"hash"`
	BlockNumber      string  `json:"blockNumber"`
	BlockHash        string  `json:"blockHash"`
	TransactionIndex int     `json:"transactionIndex"`
	From             string  `json:"from"`
	To               *string `json:"to"`
	ValueWei         string  `json:"valueWei"`
	Input            string  `json:"input"`
}

type Address struct {
	ChainID    string `json:"chainId"`
	Address    string `json:"address"`
	IsContract bool   `json:"isContract"`
}

func (c *Client) Block(ctx context.Context, id string) (Block, error) {
	id = strings.TrimSpace(id)
	if id == "" { return Block{}, errors.New("block id required") }
	path := "/v1/blocks/" + url.PathEscape(id) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	var out Block
	if err := c.getData(ctx, path, &out); err != nil { return Block{}, err }
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return Block{}, ErrWrongChain }
	return out, nil
}

func (c *Client) Transaction(ctx context.Context, hash string) (Transaction, error) {
	hash = strings.TrimSpace(hash)
	if hash == "" { return Transaction{}, errors.New("transaction hash required") }
	path := "/v1/transactions/" + url.PathEscape(hash) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	var out Transaction
	if err := c.getData(ctx, path, &out); err != nil { return Transaction{}, err }
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return Transaction{}, ErrWrongChain }
	return out, nil
}

func (c *Client) Address(ctx context.Context, address string) (Address, error) {
	address = strings.TrimSpace(address)
	if address == "" { return Address{}, errors.New("address required") }
	path := "/v1/addresses/" + url.PathEscape(address) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	var out Address
	if err := c.getData(ctx, path, &out); err != nil { return Address{}, err }
	if out.ChainID != strconv.FormatUint(c.requiredChainID, 10) { return Address{}, ErrWrongChain }
	return out, nil
}
