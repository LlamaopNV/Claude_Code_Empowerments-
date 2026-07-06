package main

import (
	"fmt"
	"math"
	"os"
	"time"
)

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func check(name string, ok bool) {
	status := "FAIL"
	if ok {
		status = "PASS"
	}
	fmt.Printf("CASE %s %s\n", name, status)
}

func main() {
	go func() { // deadlock watchdog: convert a hang into visible failure
		time.Sleep(25 * time.Second)
		fmt.Println("CASE watchdog FAIL")
		os.Exit(3)
	}()

	basic := "name,score\na,1\nb,2\nc,4\n"
	s, err := ColumnStats(basic, "score")
	check("basic", err == nil && s.Count == 3 && near(s.Min, 1) && near(s.Max, 4) && near(s.Mean, 7.0/3.0) && near(s.Median, 2))

	unsorted := "v\n9\n1\n5\n"
	s, err = ColumnStats(unsorted, "v")
	check("median-unsorted", err == nil && near(s.Median, 5) && near(s.Min, 1) && near(s.Max, 9))

	quoted := "city,pop\n\"x, y\",10\nz,20\n"
	s, err = ColumnStats(quoted, "pop")
	check("quoted-comma-field", err == nil && s.Count == 2 && near(s.Mean, 15))

	crlf := "a,b\r\n1,5\r\n2,7\r\n"
	s, err = ColumnStats(crlf, "b")
	check("crlf", err == nil && near(s.Median, 6) && near(s.Min, 5))

	neg := "v\n-3\n-1\n"
	s, err = ColumnStats(neg, "v")
	check("negatives-and-even-median", err == nil && near(s.Min, -3) && near(s.Max, -1) && near(s.Median, -2))

	spaces := "v\n 1 \n 3 \n"
	s, err = ColumnStats(spaces, "v")
	check("trims-spaces", err == nil && near(s.Mean, 2))

	single := "v\n42\n"
	s, err = ColumnStats(single, "v")
	check("single-row", err == nil && s.Count == 1 && near(s.Min, 42) && near(s.Max, 42) && near(s.Median, 42))

	_, err = ColumnStats(basic, "ghost")
	check("missing-column", err != nil)

	_, err = ColumnStats("v\nx\n", "v")
	check("bad-value", err != nil)

	_, err = ColumnStats("v\n", "v")
	check("no-data-rows", err != nil)
}
