#!/usr/bin/env python3
"""Re-level public/vocab/words.json (column 3) from open CEFR word lists.

Sources (scripts/data/):
  - CEFR-J Wordlist 1.5 (A1-B2), Tono Lab, TUFS — free for research/commercial use with citation
  - Octanove Vocabulary Profile C1/C2 1.0 — CC BY-SA 4.0
Exact headword first, then simple lemma fallbacks (plural, -ing, -ed, -ly).
Words in neither list keep their current level.
"""
import csv, json, os, sys
from collections import Counter

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA = os.path.join(os.path.dirname(__file__), 'data')
ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
L = {}
for f in ['cefrj-vocabulary-profile-1.5.csv', 'octanove-vocabulary-profile-c1c2-1.0.csv']:
    for row in csv.DictReader(open(os.path.join(DATA, f), encoding='utf-8')):
        lv = row['CEFR'].strip().upper()
        if lv not in ORDER:
            continue
        for h in row['headword'].split('/'):
            h = h.strip().lower()
            if h and (h not in L or ORDER.index(lv) < ORDER.index(L[h])):
                L[h] = lv

def look(w):
    w = w.lower()
    if w in L:
        return L[w]
    c = []
    if w.endswith('ies'): c.append(w[:-3] + 'y')
    if w.endswith('es'): c.append(w[:-2])
    if w.endswith('s'): c.append(w[:-1])
    if w.endswith('ing'): c += [w[:-3], w[:-3] + 'e'] + ([w[:-4]] if len(w) > 5 and w[-4] == w[-5] else [])
    if w.endswith('ed'): c += [w[:-2], w[:-1]] + ([w[:-3]] if len(w) > 4 and w[-3] == w[-4] else [])
    if w.endswith('ly'): c.append(w[:-2])
    return next((L[x] for x in c if x in L), None)

path = os.path.join(ROOT, 'public', 'vocab', 'words.json')
rows = json.load(open(path, encoding='utf-8'))
changed = Counter()
for r in rows:
    lv = look(r[0])
    if lv and lv != r[3]:
        changed[(r[3], lv)] += 1
        r[3] = lv
if '--dry-run' not in sys.argv:
    json.dump(rows, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('changed', sum(changed.values()), 'levels now', dict(sorted(Counter(r[3] for r in rows).items())))
