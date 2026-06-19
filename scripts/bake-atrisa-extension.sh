#!/usr/bin/env bash
#
# Bake the Atrisa VS Code extension into a freshly-built Atrisa.app as a
# built-in (system) extension.
#
# The Atrisa extension ships as a self-contained .vsix (esbuild bundle +
# allowlisted native node_modules: @lancedb/lancedb, @resvg/resvg-js, and the
# @anthropic-ai/claude-agent-sdk host-arch CLI). It is NOT wired into the
# in-repo `extensions/` build pipeline because that pipeline expects vscode's
# hoisted production-deps layout. Instead we unpack the vsix straight into the
# packaged app's built-in extensions folder, which the desktop runtime scans at
# launch (see EnvironmentService.builtinExtensionsPath).
#
# Usage:
#   scripts/bake-atrisa-extension.sh [path/to/atrisa-x.y.z.vsix] [path/to/Atrisa.app]
#
# Defaults assume the sibling layout used during development.
set -euo pipefail

VSIX="${1:-/Users/sayanmitra/Coding/Analog/atrisa/atrisa-0.1.0.vsix}"
APP="${2:-$(dirname "$(dirname "$(cd "$(dirname "$0")" && pwd)")")/../VSCode-darwin-arm64/Atrisa.app}"

[ -f "$VSIX" ] || { echo "vsix not found: $VSIX" >&2; exit 1; }
[ -d "$APP" ] || { echo "app not found: $APP" >&2; exit 1; }

EXT_ROOT="$APP/Contents/Resources/app/extensions"
DEST="$EXT_ROOT/atrisa"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Unpacking $VSIX ..."
unzip -q "$VSIX" -d "$TMP"

echo "Installing built-in extension -> $DEST"
rm -rf "$DEST"
cp -R "$TMP/extension" "$DEST"

echo "Done. Baked-in extension size: $(du -sh "$DEST" | cut -f1)"
echo "Launch: \"$APP/Contents/MacOS/Atrisa\""
