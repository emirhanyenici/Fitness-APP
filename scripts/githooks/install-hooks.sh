#!/usr/bin/env bash
# Zenova LifeScore — install git hooks
# Usage: bash scripts/githooks/install-hooks.sh   (run once per clone)
#
# Points git at the version-controlled hooks in scripts/githooks via
# core.hooksPath — no copying into .git/hooks, so updates are automatic.

set -e
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "Error: not a git repository."; exit 1; }
HOOKS_DIR="scripts/githooks"

GREEN='\033[0;32m'; NC='\033[0m'

# Ensure the hook scripts are executable (harmless on Windows/Git Bash).
chmod +x "$ROOT/$HOOKS_DIR/pre-commit" "$ROOT/$HOOKS_DIR/pre-push" "$ROOT/$HOOKS_DIR/project-check.sh" 2>/dev/null || true

git -C "$ROOT" config core.hooksPath "$HOOKS_DIR"

echo -e "${GREEN}✓${NC} core.hooksPath → $HOOKS_DIR"
echo -e "${GREEN}✓${NC} pre-commit (secret/boundary scan) and pre-push (tsc + jest) are now active."
echo "  Run 'bash $HOOKS_DIR/project-check.sh' any time for a full compliance scan."
