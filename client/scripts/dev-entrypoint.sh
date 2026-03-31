#!/bin/sh

set -eu

MARKER_FILE="node_modules/.pnpm-platform"

current_platform="$(node <<'EOF'
const report = typeof process.report?.getReport === "function" ? process.report.getReport() : null;
const libc = process.platform === "linux"
  ? report?.header?.glibcVersionRuntime
    ? "gnu"
    : "musl"
  : "native";

process.stdout.write(`${process.platform}-${process.arch}-${libc}`);
EOF
)"

if [ -f "$MARKER_FILE" ] && [ "$(cat "$MARKER_FILE")" != "$current_platform" ]; then
  echo "Detected stale node_modules for $(cat "$MARKER_FILE"), reinstalling for $current_platform..."
  rm -rf node_modules
fi

CI=true pnpm install --frozen-lockfile --store-dir=/pnpm/store
mkdir -p "$(dirname "$MARKER_FILE")"
printf '%s' "$current_platform" > "$MARKER_FILE"

exec pnpm exec next dev --webpack --hostname 0.0.0.0 --port 3000
