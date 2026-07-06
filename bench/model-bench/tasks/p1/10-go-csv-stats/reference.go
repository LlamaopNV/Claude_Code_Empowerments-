package main

import (
	"encoding/csv"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

type Stats struct {
	Count  int
	Min    float64
	Max    float64
	Mean   float64
	Median float64
}

func ColumnStats(csvText string, column string) (Stats, error) {
	rows, err := csv.NewReader(strings.NewReader(csvText)).ReadAll()
	if err != nil {
		return Stats{}, err
	}
	if len(rows) == 0 {
		return Stats{}, fmt.Errorf("empty input")
	}
	col := -1
	for i, h := range rows[0] {
		if h == column {
			col = i
			break
		}
	}
	if col == -1 {
		return Stats{}, fmt.Errorf("no such column: %s", column)
	}
	if len(rows) == 1 {
		return Stats{}, fmt.Errorf("no data rows")
	}
	values := make([]float64, 0, len(rows)-1)
	sum := 0.0
	for _, row := range rows[1:] {
		if col >= len(row) {
			return Stats{}, fmt.Errorf("short row")
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(row[col]), 64)
		if err != nil {
			return Stats{}, fmt.Errorf("bad value %q", row[col])
		}
		values = append(values, v)
		sum += v
	}
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	n := len(sorted)
	median := sorted[n/2]
	if n%2 == 0 {
		median = (sorted[n/2-1] + sorted[n/2]) / 2
	}
	return Stats{Count: n, Min: sorted[0], Max: sorted[n-1], Mean: sum / float64(n), Median: median}, nil
}
