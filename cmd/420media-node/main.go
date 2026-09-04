package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/420integrated/420-integrated/media/node/operator"
)

const version = "phase2"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "version":
		fmt.Println("420media-node", version)
	case "validate-config":
		fs := flag.NewFlagSet("validate-config", flag.ExitOnError)
		path := fs.String("config", "", "path to operator JSON config")
		_ = fs.Parse(os.Args[2:])
		if *path == "" { fmt.Fprintln(os.Stderr, "missing -config"); os.Exit(2) }
		cfg, err := operator.LoadFile(*path)
		if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
		out, _ := json.MarshalIndent(operator.Redacted(cfg), "", "  ")
		fmt.Println(string(out))
	case "show-config":
		fs := flag.NewFlagSet("show-config", flag.ExitOnError)
		path := fs.String("config", "", "path to operator JSON config")
		_ = fs.Parse(os.Args[2:])
		if *path == "" { fmt.Fprintln(os.Stderr, "missing -config"); os.Exit(2) }
		cfg, err := operator.LoadFile(*path)
		if err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
		out, _ := json.MarshalIndent(operator.Redacted(cfg), "", "  ")
		fmt.Println(string(out))
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: 420media-node <version|validate-config|show-config> [flags]")
}
