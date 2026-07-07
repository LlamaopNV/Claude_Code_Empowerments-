#!/bin/sh
DB=/tmp/shop.db
rm -f "$DB"
sqlite3 "$DB" < /work/tests/schema.sql || exit 0

# Normalize and split the solution into one file per statement. The prompt
# forbids comments and in-string semicolons, so splitting on ';' is exact.
tr -d '\r' < /work/solution.sql > /tmp/solution.sql
rm -f /tmp/q1.sql /tmp/q2.sql /tmp/q3.sql
awk 'BEGIN { RS=";"; n=0 }
     { s = $0; gsub(/^[ \t\n]+/, "", s); gsub(/[ \t\n]+$/, "", s);
       if (length(s) > 0 && n < 3) { n++; print s > ("/tmp/q" n ".sql") } }' /tmp/solution.sql

check_query() {
  n=$1
  expected=$2
  if [ ! -s "/tmp/q$n.sql" ]; then
    echo "CASE q$n-columns FAIL"
    echo "CASE q$n-rows FAIL"
    return
  fi
  actual=$(sqlite3 -csv -header "$DB" < "/tmp/q$n.sql" 2>/dev/null | tr -d '\r')
  exp_head=$(printf '%s\n' "$expected" | sed -n 1p)
  act_head=$(printf '%s\n' "$actual" | sed -n 1p)
  if [ "$act_head" = "$exp_head" ]; then
    echo "CASE q$n-columns PASS"
  else
    echo "CASE q$n-columns FAIL"
  fi
  if [ "$actual" = "$expected" ]; then
    echo "CASE q$n-rows PASS"
  else
    echo "CASE q$n-rows FAIL"
  fi
}

check_query 1 'name,total_cents
Ada,30000
Dev,30000
Ben,20000'

check_query 2 'month,revenue_cents,cumulative_cents
2025-11,30000,30000
2025-12,22000,52000
2026-01,38000,90000'

check_query 3 'category,product,share_pct
displays,Monitor,76.9
displays,Light,23.1
peripherals,Keyboard,39.5
peripherals,Mouse,39.5
peripherals,Webcam,21.1
peripherals,Cable,0.0'
