use std::io::Read;

const PUNCT: &[(char, &str)] = &[
    ('{', "LBRACE"),
    ('}', "RBRACE"),
    ('[', "LBRACKET"),
    (']', "RBRACKET"),
    ('=', "EQUALS"),
    (',', "COMMA"),
];

fn reescape(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out
}

fn main() {
    let mut src = String::new();
    std::io::stdin().read_to_string(&mut src).ok();
    let chars: Vec<char> = src.chars().collect();
    let (mut i, mut line, mut col) = (0usize, 1usize, 1usize);
    let mut out: Vec<String> = Vec::new();
    let mut error: Option<(usize, usize)> = None;

    'outer: while i < chars.len() {
        let c = chars[i];
        if c == '\n' {
            i += 1;
            line += 1;
            col = 1;
            continue;
        }
        if c == ' ' || c == '\t' || c == '\r' {
            i += 1;
            col += 1;
            continue;
        }
        if c == '#' {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue; // the newline branch resets line/col
        }
        if let Some((_, kind)) = PUNCT.iter().find(|(p, _)| *p == c) {
            out.push(format!("{} {}", kind, c));
            i += 1;
            col += 1;
            continue;
        }
        if c.is_ascii_digit() || (c == '-' && i + 1 < chars.len() && chars[i + 1].is_ascii_digit()) {
            let start = i;
            if c == '-' {
                i += 1;
            }
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            if i < chars.len() && chars[i] == '.' {
                if i + 1 < chars.len() && chars[i + 1].is_ascii_digit() {
                    i += 1;
                    while i < chars.len() && chars[i].is_ascii_digit() {
                        i += 1;
                    }
                } else {
                    error = Some((line, col + (i - start)));
                    break 'outer;
                }
            }
            let text: String = chars[start..i].iter().collect();
            col += i - start;
            out.push(format!("NUMBER {}", text));
            continue;
        }
        if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let text: String = chars[start..i].iter().collect();
            col += i - start;
            let kind = if text == "true" || text == "false" { "BOOL" } else { "IDENT" };
            out.push(format!("{} {}", kind, text));
            continue;
        }
        if c == '"' {
            let (sl, sc) = (line, col);
            i += 1;
            col += 1;
            let mut value = String::new();
            loop {
                if i >= chars.len() || chars[i] == '\n' {
                    error = Some((sl, sc)); // unterminated: report the opening quote
                    break 'outer;
                }
                let ch = chars[i];
                if ch == '"' {
                    i += 1;
                    col += 1;
                    break;
                }
                if ch == '\\' {
                    if i + 1 >= chars.len() || chars[i + 1] == '\n' {
                        error = Some((sl, sc));
                        break 'outer;
                    }
                    let decoded = match chars[i + 1] {
                        '"' => '"',
                        '\\' => '\\',
                        'n' => '\n',
                        't' => '\t',
                        _ => {
                            error = Some((line, col)); // bad escape: the backslash
                            break 'outer;
                        }
                    };
                    value.push(decoded);
                    i += 2;
                    col += 2;
                    continue;
                }
                value.push(ch);
                i += 1;
                col += 1;
            }
            out.push(format!("STRING {}", reescape(&value)));
            continue;
        }
        error = Some((line, col));
        break;
    }

    for l in &out {
        println!("{}", l);
    }
    if let Some((l, c)) = error {
        println!("ERROR {}:{}", l, c);
    }
}
