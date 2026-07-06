Write a Go file (saved as `solution.go`). It must declare `package main` but
must NOT define `func main` — the grader compiles your file together with its
own main. Use only the Go standard library.

Define exactly this type and function:

    type Stats struct {
        Count  int
        Min    float64
        Max    float64
        Mean   float64
        Median float64
    }

    func ColumnStats(csvText string, column string) (Stats, error)

`csvText` is a CSV document (RFC-4180 style: the first row is the header;
fields may be quoted and quoted fields may contain commas; both \n and \r\n
line endings must work — use encoding/csv).

Behavior (follow exactly):

- Locate `column` by exact, case-sensitive match against the header row.
- Parse every data-row value in that column as a float64. Surrounding ASCII
  spaces are trimmed before parsing ("  1.5 " is 1.5).
- Return Stats over those values: Count, Min, Max, Mean, and Median (for an
  even count, the median is the mean of the two middle values after
  sorting; the input order is arbitrary).
- Return a non-nil error (any message) when: the column is not in the
  header, there are zero data rows, any value in the column fails to parse
  as a number, or the CSV itself is malformed.
