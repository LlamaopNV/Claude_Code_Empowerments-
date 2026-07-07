Implement a spreadsheet formula evaluator in plain JavaScript (Node.js,
CommonJS, no dependencies, no imports). Your reply will be saved as
`solution.cjs`.

Write a module that exports a single function:
`module.exports = { evaluateSheet }`.

`evaluateSheet(cells)` takes an object mapping cell names (like "A1", "B12",
"AA3") to raw string contents, and returns a new object with exactly the same
keys mapped to computed values.

Rules:

1. Cell content types:
   - If the trimmed content parses entirely as a finite decimal number (e.g.
     "42", "-3.5", "  7 ", "1e3"), the cell's value is that number.
   - Otherwise, if the content starts with "=", it is a formula (see below).
   - Otherwise the cell's value is the original string, unchanged (a text
     cell).

2. Formula grammar (everything after the "="): infix expressions with
   `+ - * /`, parentheses, unary minus, non-negative decimal number literals
   (like `2`, `3.5`), cell references, and function calls `SUM`, `AVG`,
   `MIN`, `MAX`. Standard operator precedence (`*` and `/` bind tighter than
   `+` and `-`), left associativity. Whitespace may appear anywhere between
   tokens.
   - Number literals in formulas are digits with an optional fractional part
     ONLY. Exponent notation is NOT part of the grammar: `=1e3` is a
     syntactically invalid formula (so it evaluates to "#ERR"), even though
     the plain cell content "1e3" (no "=") is a number cell per rule 1.
   - Function arguments are comma-separated; each argument is either an
     expression or a rectangular range like `A1:B3`. Functions require at
     least one argument.
   - Whitespace is allowed around the `:` in a range: `A1 : B3` is valid.
   - Stacked unary minus is valid: `=--5` is 5, `=1--2` is 3, `=-(-A1)`
     works.
   - A range `A1:B3` covers every cell in the rectangle spanned by the two
     corner cells (inclusive), regardless of the order in which the corners
     are given.
   - Cell references and function names are case-insensitive ("a1" means
     "A1", "sum" means "SUM"). Column letters beyond Z work like spreadsheet
     columns ("AA1" is column 27, row 1).

3. Evaluation:
   - Referencing a cell that is not present in the input object yields 0.
     Cells of a range that are absent from the input also count as 0 (a
     range always covers the full rectangle of coordinates, present or not).
   - AVG divides by the total number of values covered, where a range
     contributes one value per cell in its rectangle (absent cells counting
     as 0) and a plain expression argument contributes one value.
   - A formula that references a text cell (directly or via a range)
     evaluates to the string "#ERR".
   - Division by zero evaluates to "#ERR".
   - A syntactically invalid formula evaluates to "#ERR".
   - A formula that references a cell whose computed value is "#ERR" or
     "#CIRC" evaluates to "#ERR".
   - Every cell that participates in a reference cycle (directly or
     indirectly, e.g. "=A1" in cell A1, or A1 and B1 referencing each other)
     evaluates to the string "#CIRC". Cells that merely reference a cycle
     (but are not part of one) follow the previous rule and evaluate to
     "#ERR".

4. Returned values: number cells return their number, text cells return
   their original string, formula cells return a number, "#ERR", or "#CIRC".
