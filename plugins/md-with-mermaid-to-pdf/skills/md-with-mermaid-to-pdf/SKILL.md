---
name: md-with-mermaid-to-pdf
description: Convert a markdown file containing mermaid diagrams to PDF. Renders all mermaid code blocks to SVGs, produces a rendered markdown file, then converts to PDF.
argument-hint: <filepath.md>
---

# Markdown to PDF with Mermaid Diagrams

Convert a markdown file to PDF with rendered mermaid diagrams.

## Arguments

`$ARGUMENTS` — absolute path to the source markdown file.

## Steps

1. **Render mermaid diagrams to SVGs:**

   Run `mmdc` (mermaid-cli) against the source markdown file. This finds all mermaid code blocks, renders each to an SVG, and produces a new markdown file with the mermaid blocks replaced by `![diagram](./filename-N.svg)` image references.

   ```bash
   mmdc -i "<source-file>" -o "<source-dir>/<basename>-rendered.md"
   ```

   Run this from the source file's directory so SVGs are co-located.

2. **Convert rendered markdown to PDF:**

   Run `md-to-pdf` on the rendered markdown file with A4 formatting and print background enabled.

   ```bash
   npx --yes md-to-pdf "<source-dir>/<basename>-rendered.md" --pdf-options '{"format": "A4", "margin": {"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"}, "printBackground": true}'
   ```

3. **Report results:**

   Tell the user the output file paths:
   - SVG files: `<basename>-rendered-N.svg` (one per mermaid diagram)
   - Rendered markdown: `<basename>-rendered.md`
   - PDF: `<basename>-rendered.pdf`

## Important

- Always `cd` into the source file's directory before running commands, so SVG relative paths resolve correctly.
- Use the full absolute path for the source file.
- The rendered markdown and PDF are written alongside the source file.
- Do not modify the original source markdown file.
