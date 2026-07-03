#!/usr/bin/env bash
# Zenova LifeScore — project compliance scanner
# Usage: bash scripts/githooks/project-check.sh
# Exit 1 only on hard security errors; warnings are advisory.

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ERRORS=0; WARNINGS=0; PASSES=0

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
err()  { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS+1)); }
pass() { echo -e "  ${GREEN}✓${NC} $1"; PASSES=$((PASSES+1)); }
section() { echo -e "\n${BOLD}${CYAN}[$1]${NC} $2"; }

echo -e "${BOLD}━━━ Zenova LifeScore — Compliance Scanner ━━━${NC}"
echo "  Root: $ROOT"

# ① SECURITY ───────────────────────────────────────────────────────────────────
section "1" "Security"

SECRET_HITS=$(grep -rn --include="*.ts" --include="*.tsx" \
  -E "sk-ant-|sk-proj-|service_role" \
  "$ROOT/app" "$ROOT/components" "$ROOT/hooks" "$ROOT/stores" "$ROOT/services" 2>/dev/null || true)
if [ -n "$SECRET_HITS" ]; then err "AI/service-role secret in client code:\n$(echo "$SECRET_HITS" | head -3)"; else pass "No AI/service-role secrets in client code"; fi

if [ -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.gitignore" ] && grep -qE "^\.env" "$ROOT/.gitignore"; then pass ".env exists and is gitignored"; else err ".env exists but is NOT gitignored — add it NOW"; fi
else
  pass "No committed .env"
fi

AI_CLIENT_HITS=$(grep -rn --include="*.ts" --include="*.tsx" \
  -E "api\.anthropic\.com|api\.openai\.com" \
  "$ROOT/app" "$ROOT/components" "$ROOT/hooks" "$ROOT/stores" "$ROOT/services" 2>/dev/null || true)
if [ -n "$AI_CLIENT_HITS" ]; then err "Direct AI API call in client:\n$(echo "$AI_CLIENT_HITS" | head -3)"; else pass "AI calls only via edge functions"; fi

# ② ARCHITECTURE ───────────────────────────────────────────────────────────────
section "2" "Architecture"

ZUSTAND_HITS=$(grep -rn --include="*.ts" --include="*.tsx" "from 'zustand'" "$ROOT/app" "$ROOT/components" 2>/dev/null || true)
if [ -n "$ZUSTAND_HITS" ]; then warn "Zustand imported outside stores/:\n$(echo "$ZUSTAND_HITS" | head -3)"; else pass "Zustand only in stores/"; fi

HEX_HITS=$(grep -rn --include="*.tsx" -E "#[0-9A-Fa-f]{6}" "$ROOT/app" "$ROOT/components" 2>/dev/null | grep -vE "colors\.ts|//|BMI|#3B82F6|#FF0000" | wc -l | tr -d ' ')
if [ "${HEX_HITS:-0}" -gt 0 ]; then warn "$HEX_HITS hardcoded hex color(s) in components — prefer constants/colors.ts"; else pass "No stray hardcoded hex colors"; fi

# ③ STRUCTURE ──────────────────────────────────────────────────────────────────
section "3" "File structure"
REQUIRED_DIRS=("app/(auth)" "app/(onboarding)" "app/(tabs)" "app/modals" "components/ui" "hooks" "stores" "services" "constants" "supabase/functions")
MISSING=0
for dir in "${REQUIRED_DIRS[@]}"; do
  [ -d "$ROOT/$dir" ] || { warn "Missing directory: $dir"; MISSING=$((MISSING+1)); }
done
[ $MISSING -eq 0 ] && pass "All required directories present"

# Edge functions that actually exist in this project.
for fn in ai-coach analyze-photo; do
  if [ -f "$ROOT/supabase/functions/$fn/index.ts" ]; then pass "edge function: $fn"; else warn "Missing edge function: $fn"; fi
done

# ④ QUALITY ────────────────────────────────────────────────────────────────────
section "4" "Code quality"

CONSOLE_COUNT=$(grep -rn --include="*.ts" --include="*.tsx" "console\.log" "$ROOT/app" "$ROOT/components" "$ROOT/hooks" "$ROOT/stores" 2>/dev/null | grep -v "__DEV__" | wc -l | tr -d ' ')
if [ "${CONSOLE_COUNT:-0}" -gt 0 ]; then warn "$CONSOLE_COUNT console.log in production code"; else pass "No console.log in production code"; fi

if [ -f "$ROOT/constants/colors.ts" ]; then pass "constants/colors.ts present"; else err "constants/colors.ts missing"; fi

# FINAL ────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}✓ Passed:${NC} $PASSES   ${YELLOW}⚠ Warnings:${NC} $WARNINGS   ${RED}✗ Errors:${NC} $ERRORS"
if [ $ERRORS -gt 0 ]; then echo -e "  ${RED}${BOLD}FAIL${NC} — fix $ERRORS error(s)"; exit 1; fi
echo -e "  ${GREEN}${BOLD}OK${NC}"; exit 0
