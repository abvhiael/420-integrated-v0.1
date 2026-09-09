package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type startup struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}

func main() {
	out, err := json.Marshal(startup{Service: "420Indexer", Status: "IMPLEMENTATION_ACTIVE"})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(string(out))
}
