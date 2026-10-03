#!/usr/bin/env python3
"""Apply proofread entries to public/vocab/words.json.

Input: text files, one word per line:
  word | pos | meanings (، separated) | def_en | def_fa | ex_en | ex_fa | synonyms (comma separated, optional)
A field that is exactly "=" keeps the current value (e.g. a correct WordNet definition).
Extra senses of the same word follow on lines starting with "+":
  + word | pos | meaning | def_en | def_fa | ex_en | ex_fa
They are stored in column 11 ([[pos, fa, d, df, e, ef], ...], primary sense first) and their
meanings are appended to column 1.
Replaces meaning/pos/definition/example/synonym columns; keeps topic, level and score.
Drops the extra-senses column (11) for rewritten words.
Usage: python3 scripts/apply-vocab-fixes.py FILE...
"""
import re, json, os, sys

path = os.path.join(os.path.dirname(__file__), '..', 'public', 'vocab', 'words.json')
rows = json.load(open(path, encoding='utf-8'))
by = {r[0].lower(): r for r in rows}
orig = {r[0].lower(): list(r) for r in rows}  # '=' on a '+' line refers to the value before this run
done, missing, bad = 0, [], []
for f in sys.argv[1:]:
    for n, line in enumerate(open(f, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        p = [x.strip() for x in line.split('|')]
        if len(p) < 7 or not p[0] or not p[2] or not p[3]:
            bad.append(f'{os.path.basename(f)}:{n}')
            continue
        extra = p[0].startswith('+')
        if extra:
            p[0] = p[0][1:].strip()
        r = by.get(p[0].lower())
        if not r:
            missing.append(p[0])
            continue
        fa = [m.strip() for m in re.split(r'،(?![^()]*\))', p[2]) if m.strip()]  # keep «(آب، برق)» whole
        if extra:
            if len(r) < 12:
                r.append([[r[4], '، '.join(r[1]), r[5], r[10], r[6], r[9]]])
            o = orig[p[0].lower()]
            ov = {1: o[4], 3: o[5], 4: o[10], 5: o[6], 6: o[9]}
            q = [ov[i] if i in ov and p[i] == '=' else p[i] for i in range(7)]
            r[11].append([q[1], q[2], q[3], q[4], q[5], q[6]])
            r[1] += [m for m in fa if m not in r[1]]
            continue
        syn = [s.strip() for s in (p[7] if len(p) > 7 else '').split(',') if s.strip()]
        keep = lambda v, old: old if v == '=' else v
        r[1] = r[1] if p[2] == '=' else fa
        r[4], r[5], r[10], r[6], r[9] = keep(p[1], r[4]), keep(p[3], r[5]), keep(p[4], r[10]), keep(p[5], r[6]), keep(p[6], r[9])
        r[7] = r[7] if len(p) > 7 and p[7] == '=' else syn
        del r[11:]
        done += 1
if bad:
    sys.exit('malformed lines: ' + ', '.join(bad))
json.dump(rows, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'updated {done}' + (f', not found: {missing}' if missing else ''))
