"""Minimal MySQL dump reader: pulls rows of a given table out of a mysqldump .sql file."""
import re


def _split_values(blob):
    """Split the VALUES payload of an INSERT into row tuples of Python values."""
    rows, cur, val = [], [], []
    i, n = 0, len(blob)
    in_str = False
    quoted = False          # current value was a quoted string literal
    depth = 0
    while i < n:
        c = blob[i]
        if in_str:
            if c == '\\':
                nxt = blob[i + 1] if i + 1 < n else ''
                val.append({'n': '\n', 't': '\t', 'r': '\r', '0': '\0',
                            'b': '\b', 'Z': '\x1a'}.get(nxt, nxt))
                i += 2
                continue
            if c == "'":
                if i + 1 < n and blob[i + 1] == "'":
                    val.append("'")
                    i += 2
                    continue
                in_str = False
                i += 1
                continue
            val.append(c)
            i += 1
            continue
        if c == "'":
            in_str = True
            quoted = True
            val = []            # drop any whitespace picked up before the quote
            i += 1
            continue
        if c == '(':
            depth += 1
            if depth == 1:
                cur, val, quoted = [], [], False
                i += 1
                continue
        elif c == ')':
            depth -= 1
            if depth == 0:
                cur.append((''.join(val), quoted))
                rows.append(cur)
                cur, val, quoted = [], [], False
                i += 1
                continue
        elif c == ',' and depth == 1:
            cur.append((''.join(val), quoted))
            val, quoted = [], False
            i += 1
            continue
        if depth >= 1:
            val.append(c)
        i += 1
    out = []
    for r in rows:
        conv = []
        for v, was_quoted in r:
            if was_quoted:
                conv.append(v)
            else:
                s = v.strip()
                conv.append(None if s.upper() == 'NULL' else s)
        out.append(conv)
    return out


def read_table(path, table):
    """Return (columns, rows) for `table`. Rows are lists of str/None."""
    cols, chunks = None, []
    ins_re = re.compile(r'^INSERT INTO `%s` \(([^)]*)\) VALUES' % re.escape(table))
    create_re = re.compile(r'^CREATE TABLE `%s`' % re.escape(table))
    with open(path, encoding='utf-8', errors='replace') as fh:
        in_create, buf, collecting = False, [], False
        create_cols = []
        for line in fh:
            if create_re.match(line):
                in_create, create_cols = True, []
                continue
            if in_create:
                m = re.match(r'\s+`([^`]+)`\s', line)
                if m:
                    create_cols.append(m.group(1))
                if line.startswith(')'):
                    in_create = False
                continue
            m = ins_re.match(line)
            if m:
                cols = [c.strip().strip('`') for c in m.group(1).split(',')]
                buf = [line[m.end():]]
                collecting = True
                if line.rstrip().endswith(';'):
                    chunks.append(''.join(buf))
                    collecting = False
                continue
            if collecting:
                buf.append(line)
                if line.rstrip().endswith(';'):
                    chunks.append(''.join(buf))
                    collecting = False
        if cols is None and create_cols:
            cols = create_cols
    rows = []
    for ch in chunks:
        rows.extend(_split_values(ch))
    return cols, rows


def dicts(path, table):
    cols, rows = read_table(path, table)
    if not cols:
        return []
    return [dict(zip(cols, r)) for r in rows if len(r) == len(cols)]
