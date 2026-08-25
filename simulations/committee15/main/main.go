package main

import (
	"flag"
	"fmt"
	"os"

	sim "github.com/420integrated/420-integrated/simulations/committee15"
)

func main() {
	primaryDown := flag.Bool("primary-down", false, "simulate primary proposer unavailable")
	fb1Down := flag.Bool("fb1-down", false, "simulate fallback-1 unavailable")
	flag.Parse()

	s, err := sim.Summary(!*primaryDown, !*fb1Down)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(s)
}
