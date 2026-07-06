#!/bin/sh
# Compile once; a compile error prints no CASE lines => COMPILE_FAIL.
rustc --edition 2021 -O -o /tmp/sol /work/solution.rs 2>&1 || exit 0

run_case() {
  name=$1
  input=$2
  expected=$3
  actual=$(printf '%s' "$input" | /tmp/sol 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    echo "CASE $name PASS"
  else
    echo "CASE $name FAIL"
  fi
}

run_case kv-and-string 'name = "app"
count = 42' 'IDENT name
EQUALS =
STRING app
IDENT count
EQUALS =
NUMBER 42'

run_case numbers 'a = -3.5
b = 0.25
c = -7' 'IDENT a
EQUALS =
NUMBER -3.5
IDENT b
EQUALS =
NUMBER 0.25
IDENT c
EQUALS =
NUMBER -7'

run_case bools-vs-idents 'flag = true
other = falsehood' 'IDENT flag
EQUALS =
BOOL true
IDENT other
EQUALS =
IDENT falsehood'

run_case list 'tags = ["x", "y"]' 'IDENT tags
EQUALS =
LBRACKET [
STRING x
COMMA ,
STRING y
RBRACKET ]'

run_case braces 'server { port = 8080 }' 'IDENT server
LBRACE {
IDENT port
EQUALS =
NUMBER 8080
RBRACE }'

run_case comments '# top comment
x = 1 # trailing' 'IDENT x
EQUALS =
NUMBER 1'

run_case string-escapes 'm = "a\"b\\c\nd\te"' 'IDENT m
EQUALS =
STRING a"b\\c\nd\te'

run_case error-position 'x = 1
y = @' 'IDENT x
EQUALS =
NUMBER 1
IDENT y
EQUALS =
ERROR 2:5'

run_case unterminated-string 's = "abc' 'IDENT s
EQUALS =
ERROR 1:5'

run_case bad-escape 'v = "a\qb"' 'IDENT v
EQUALS =
ERROR 1:7'

run_case empty-input '' ''
