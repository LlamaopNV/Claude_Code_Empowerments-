package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func parseIP(s string) uint32 {
	var n uint32
	for _, part := range strings.Split(s, ".") {
		v, _ := strconv.Atoi(part)
		n = n<<8 | uint32(v)
	}
	return n
}

type cidr struct {
	raw  string
	net  uint32
	mask uint32
}

func main() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	read := func() string {
		if sc.Scan() {
			return strings.TrimSpace(sc.Text())
		}
		return ""
	}
	n, _ := strconv.Atoi(read())
	cidrs := make([]cidr, 0, n)
	for i := 0; i < n; i++ {
		raw := read()
		parts := strings.Split(raw, "/")
		plen, _ := strconv.Atoi(parts[1])
		var mask uint32
		if plen > 0 {
			mask = ^uint32(0) << (32 - uint(plen))
		}
		cidrs = append(cidrs, cidr{raw, parseIP(parts[0]) & mask, mask})
	}
	m, _ := strconv.Atoi(read())
	w := bufio.NewWriter(os.Stdout)
	defer w.Flush()
	for i := 0; i < m; i++ {
		ip := parseIP(read())
		match := "none"
		for _, c := range cidrs {
			if ip&c.mask == c.net {
				match = c.raw
				break
			}
		}
		fmt.Fprintln(w, match)
	}
}
