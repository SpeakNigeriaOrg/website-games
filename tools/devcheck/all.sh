#!/usr/bin/env sh
# Plays every dev game through its script in portrait and landscape; prints one line per run.
# Path-mode scripts are skipped here: path_sweep.mjs plays them on real path stones.
# Needs the dev server: node tools/devcheck/serve.mjs dev/games 8000
cd "$(dirname "$0")/../.."
fail=0
for f in tools/devcheck/plays/*.js; do
  g=$(basename "$f" .js); game=${g%%_*}
  # path scripts need a path query (tools/devcheck/path_sweep.mjs runs them on real stones)
  case "$g" in *_path|*_tone|path_*) continue ;; esac
  for o in "" --landscape; do
    r=$(node tools/devcheck/check.mjs "$game" "$f" $o 2>&1 | grep -E "^(PASS|FAIL)" | head -1)
    echo "$g ${o:-portrait}: $r"
    case "$r" in PASS*) ;; *) fail=1 ;; esac
  done
done
exit $fail
