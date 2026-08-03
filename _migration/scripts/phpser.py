"""Tiny PHP serialize() reader — enough for WordPress option/meta values."""


def loads(s):
    val, _ = _read(s, 0)
    return val


def _read(s, i):
    t = s[i]
    if t == 'N':
        return None, i + 2
    if t == 'b':
        j = s.index(';', i)
        return s[i + 2:j] == '1', j + 1
    if t == 'i':
        j = s.index(';', i)
        return int(s[i + 2:j]), j + 1
    if t == 'd':
        j = s.index(';', i)
        raw = s[i + 2:j]
        return float(raw) if raw not in ('NAN', 'INF', '-INF') else raw, j + 1
    if t == 's':
        j = s.index(':', i + 2)
        n = int(s[i + 2:j])
        start = j + 2
        return s[start:start + n], start + n + 2
    if t in 'aO':
        if t == 'O':
            j = s.index(':', i + 2)
            nlen = int(s[i + 2:j])
            i = j + 2 + nlen + 2
            j = s.index(':', i)
            cnt = int(s[i:j])
            i = j + 2
        else:
            j = s.index(':', i + 2)
            cnt = int(s[i + 2:j])
            i = j + 2
        out = {}
        for _ in range(cnt):
            k, i = _read(s, i)
            v, i = _read(s, i)
            out[k] = v
        i += 1
        if all(isinstance(k, int) for k in out) and list(out) == list(range(len(out))):
            return list(out.values()), i
        return out, i
    raise ValueError(f'unsupported type {t!r} at {i}')
