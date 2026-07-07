Write a complete Rust program (saved as `solution.rs`, compiled with plain
`rustc`, edition 2021, no crates). It reads an entire config document from
stdin and prints one line per token to stdout:

    KIND LEXEME

(a single space between KIND and LEXEME). Always exit with status 0.

Token kinds and rules (follow exactly):

- Whitespace (space, tab, \r, newline) separates tokens and is skipped.
- Comments: `#` starts a comment that runs to end of line; skipped entirely.
- Punctuation, with the character itself as the lexeme:
  `{` LBRACE, `}` RBRACE, `[` LBRACKET, `]` RBRACKET, `=` EQUALS, `,` COMMA.
- IDENT: a letter or `_`, followed by letters, digits, or `_`. Lexeme = the
  raw text. The exact words `true` and `false` are BOOL instead (so
  `falsehood` is an IDENT).
- NUMBER: optional `-` (only when a digit immediately follows it), one or
  more digits, then optionally `.` followed by one or more digits. Lexeme =
  the raw text. A `.` not followed by a digit is an error located at the `.`.
- STRING: double-quoted, must close on the same line. Escapes: \" (quote),
  \\ (backslash), \n (newline), \t (tab); any other `\x` is an error located
  at the backslash. The lexeme is the DECODED value, re-escaped for display
  so the output stays one line: newline prints as `\n`, tab as `\t`,
  backslash as `\\` (a plain `"` prints as `"`).
- On the first lexing error: print the tokens found so far, then one line
  `ERROR <line>:<col>` (both 1-based; col counts characters, a tab is one
  column) and stop. The error position is the offending character, except:
  an unterminated string (EOF or raw newline before the closing quote)
  reports the position of the OPENING quote.
- Empty input produces no output.
