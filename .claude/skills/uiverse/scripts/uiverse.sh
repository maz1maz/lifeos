#!/usr/bin/env bash
# Uiverse.io helper — source: github.com/uiverse-io/galaxy (MIT, ~3800 elements).
# Usage:
#   uiverse.sh cats                         list categories + counts
#   uiverse.sh search <category> [words…]   files whose Tags/author/name match ALL words
#   uiverse.sh show <category>/<file>.html  print the element (HTML + <style>)
#   uiverse.sh random <category> [n]        n random picks (default 5)
# Categories: Buttons Cards Checkboxes Forms Inputs Notifications Patterns
#             Radio-buttons Toggle-switches Tooltips loaders
set -euo pipefail
CACHE="${UIVERSE_CACHE:-${TMPDIR:-/tmp}/uiverse-galaxy}"
ensure() {
  if [ ! -d "$CACHE/.git" ]; then
    git clone -q --depth 1 --filter=blob:none --sparse https://github.com/uiverse-io/galaxy.git "$CACHE"
  fi
}
need_cat() { # materialise one category folder (sparse) on demand
  ensure
  ( cd "$CACHE" && git sparse-checkout add "$1" >/dev/null 2>&1 || true )
  [ -d "$CACHE/$1" ] || { echo "unknown category: $1 (run: $0 cats)" >&2; exit 1; }
}
cmd="${1:-help}"; shift || true
case "$cmd" in
  cats) ensure; (cd "$CACHE" && git ls-files | grep / | cut -d/ -f1 | sort | uniq -c) ;;
  search)
    cat="$1"; shift; need_cat "$cat"
    cd "$CACHE"
    for f in "$cat"/*.html; do
      head -c 4000 "$f" | grep -o 'From Uiverse.io[^*>]*' | head -1 > /tmp/.uv_line || true
      line="$(basename "$f") $(cat /tmp/.uv_line)"
      ok=1; for w in "$@"; do echo "$line" | grep -qi -- "$w" || { ok=0; break; }; done
      [ $ok = 1 ] && echo "$cat/$(basename "$f")  ::  $(cat /tmp/.uv_line)"
    done | head -40 ;;
  show) need_cat "${1%%/*}"; cat "$CACHE/$1" ;;
  random) need_cat "$1"; ls "$CACHE/$1" | shuf -n "${2:-5}" | sed "s#^#$1/#" ;;
  *) sed -n '2,9p' "$0" ;;
esac
