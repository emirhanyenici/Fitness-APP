# Claude Code Skills — AURA Health App

This file defines Claude Code skills integrated into the AURA Health project.
Installed from: [Trail of Bits Skills Marketplace](https://github.com/trailofbits/skills)

---

## Security Skills

Security skills are automatically triggered when performing code reviews, audits, or when security-relevant changes are made to the codebase.

---

### 1. insecure-defaults

**Source:** `trailofbits/skills/plugins/insecure-defaults`
**Maintainers:** @dariushoule, @dguido

**Description:**
Detects insecure default configurations, hardcoded credentials, weak cryptographic parameters, fail-open patterns, and insecure default settings throughout the codebase.

**Relevance to AURA Health:**
- Hardcoded USDA API key in `services/usda.ts`
- Wildcard CORS header in `supabase/functions/ai-coach/index.ts`
- Weak password minimum (6 chars) in `app/(auth)/reset-password.tsx`
- Email-based Pro plan bypass (`+pro` suffix) in `app/_layout.tsx`

**When to trigger:**
- When reviewing any new service file or API integration
- When adding authentication or authorization logic
- When reviewing environment variable usage
- When any `fetch()` call is added or modified

**Example audit workflow:**
```
1. Scan all service files for hardcoded secrets or API keys
2. Check all auth-related files for fail-open patterns
3. Review CORS headers on any server-side function
4. Verify all feature gates have server-side validation
5. Confirm no default credentials or test bypasses remain in production code
```

**Integration notes:**
- Run before every PR merge involving `services/`, `stores/`, or `supabase/functions/`
- Flag any `process.env.*` usage not guarded by a defined fallback validation

---

### 2. semgrep-rule-creator

**Source:** `trailofbits/skills/plugins/semgrep-rule-creator`
**Maintainers:** @ahpaleus, @dguido

**Description:**
Creates production-quality Semgrep rules for detecting custom vulnerability patterns specific to this codebase. Rules are written with test cases and validated before use.

**Relevance to AURA Health:**
- Custom rules needed for `isPro`/`isElite` client-side gate bypass patterns
- Rules for detecting hardcoded API keys in TypeScript/TSX files
- Rules for unvalidated deep link token extraction
- Rules for unencrypted AsyncStorage writes of sensitive data

**When to trigger:**
- When a new class of vulnerability is identified that needs systematic scanning
- When a security bug is fixed and we want to prevent regressions
- When a new API integration pattern is introduced

**Example audit workflow:**
```
1. Identify the vulnerability pattern (e.g., "client-side isPro check without server validation")
2. Write a Semgrep rule targeting that pattern in TypeScript/TSX
3. Create true-positive and true-negative test cases
4. Validate rule has no false positives across the full codebase
5. Add rule to CI/CD pipeline via semgrep.yml
```

**Example Semgrep rule (client-side subscription gate):**
```yaml
rules:
  - id: client-side-subscription-gate
    patterns:
      - pattern: if ($STORE.isPro) { ... }
      - pattern: if ($STORE.isElite) { ... }
      - pattern: if (!$STORE.isPro) { ... }
    message: |
      Client-side subscription gate detected. Subscription status must be
      validated server-side to prevent privilege escalation.
    languages: [typescript, tsx]
    severity: ERROR
    metadata:
      category: security
      cwe: CWE-602
```

**Integration notes:**
- Install Semgrep: `pip install semgrep`
- Run: `semgrep --config .semgrep/ --lang typescript app/ stores/ services/`
- Add to CI: integrate semgrep scan in GitHub Actions on PRs

---

### 3. supply-chain-risk-auditor

**Source:** `trailofbits/skills/plugins/supply-chain-risk-auditor`
**Maintainers:** @smichaels-tob, @dguido

**Description:**
Generates a supply-chain threat landscape report for the project's direct dependencies, analyzing maintainer count, CVE history, update frequency, and abandonment risk.

**Relevance to AURA Health:**
- `react-native-purchases@^9.11.0` — RevenueCat SDK, critical for payment flows
- `@supabase/supabase-js@^2.98.0` — Auth and database, highest attack surface
- `posthog-react-native@^4.37.1` — Receives all user analytics events
- `expo@~52.0.0` — Core framework, transitive dependency risk
- `@tanstack/react-query@^5.90.21` — Data fetching, potential for request forgery

**When to trigger:**
- Before any dependency upgrade
- When adding a new npm package
- Monthly scheduled dependency audit
- After any public CVE disclosure affecting React Native ecosystem

**Example audit workflow:**
```
1. Run: npm audit --json > audit-report.json
2. Run: npx better-npm-audit audit
3. Check OSV database for all direct dependencies
4. Review maintainer counts on npmjs.com for critical packages
5. Check last publish date — flag packages inactive >12 months
6. Review CHANGELOG for security-related updates
7. Generate pinned lockfile and commit it
```

**Integration notes:**
- Run `npm audit` in CI on every dependency change
- Use `package-lock.json` (committed) to detect lockfile tampering
- Consider `npm audit --audit-level=moderate` as a CI gate

---

### 4. differential-review

**Source:** `trailofbits/skills/plugins/differential-review`
**Maintainers:** Trail of Bits

**Description:**
Performs a security-focused review of code diffs/changes, analyzing git history to identify newly introduced vulnerabilities, regressions, or security-sensitive modifications.

**Relevance to AURA Health:**
- Review every change to auth flows (`stores/authStore.ts`, `app/(auth)/`)
- Review every change to subscription logic (`stores/subscriptionStore.ts`)
- Review every change to the Edge Function (`supabase/functions/ai-coach/`)
- Review any addition of new `fetch()` calls or external API integrations

**When to trigger:**
- On every PR that touches: `stores/`, `app/(auth)/`, `app/_layout.tsx`, `services/`, `supabase/`
- When CORS headers are modified
- When authentication state management changes
- When new deep link handlers are added

**Example audit workflow:**
```
1. git diff main HEAD -- stores/ app/(auth)/ services/ supabase/
2. For each changed file, identify: new API calls, changed auth logic, modified feature gates
3. Check if new code introduces hardcoded values, secrets, or insecure patterns
4. Verify auth state changes are properly guarded
5. Confirm no test-only bypasses are merged to production
```

**Integration notes:**
- Create a PR template checklist requiring sign-off on security-sensitive files
- Treat `app/_layout.tsx`, `stores/authStore.ts`, `stores/subscriptionStore.ts` as high-sensitivity files

---

### 5. variant-analysis

**Source:** `trailofbits/skills/plugins/variant-analysis`
**Maintainers:** Trail of Bits

**Description:**
Scans the entire codebase for variants of a known vulnerability. Once one vulnerability pattern is found, systematically searches for all similar instances across all files.

**Relevance to AURA Health:**
- After finding `+pro` email bypass, search for all other privilege escalation patterns
- After finding hardcoded USDA key, scan for all other hardcoded credentials
- After finding URL-fragment token extraction, find all similar deep link handlers

**When to trigger:**
- After any new vulnerability is discovered during audit
- When a security fix is applied — check for identical patterns elsewhere
- During periodic security reviews

**Example audit workflow:**
```
1. Identify the vulnerability pattern (e.g., "hardcoded API key assignment")
2. Search all TypeScript files: grep -r "const.*KEY\s*=\s*'" app/ services/ stores/
3. Search all env usages: grep -r "process\.env\." app/ services/ | grep -v "EXPO_PUBLIC_"
4. Review every match for security implications
5. Apply fixes to all variants, not just the originally reported instance
```

---

### 6. sharp-edges

**Source:** `trailofbits/skills/plugins/sharp-edges`
**Maintainers:** Trail of Bits

**Description:**
Identifies error-prone APIs, dangerous function calls, and footgun designs that commonly lead to security vulnerabilities. Flags usage of APIs that require special care.

**Relevance to AURA Health:**
- `AsyncStorage` without encryption for sensitive health data
- `url.split('#')[1]` for token extraction (fragile, injection-prone)
- `encodeURIComponent()` used in USDA query but not validated
- `eval()` / `JSON.parse()` without try-catch on untrusted data
- Supabase `.setSession()` called with unvalidated external tokens

**When to trigger:**
- When any new data storage mechanism is introduced
- When URL parsing or deep link handling is added
- When external data is parsed without schema validation
- When auth tokens are handled in client code

**Example audit workflow:**
```
1. Search for dangerous storage APIs: grep -r "AsyncStorage.setItem" app/ stores/
2. Search for URL manipulation: grep -r "split\|indexOf\|includes" app/_layout.tsx
3. Search for eval or dynamic execution: grep -r "eval\|Function(" app/ services/
4. Search for JSON.parse without validation: grep -r "JSON.parse" app/ services/
5. Flag each instance and assess the risk of the surrounding context
```

---

### 7. entry-point-analyzer

**Source:** `trailofbits/skills/plugins/entry-point-analyzer`
**Maintainers:** Trail of Bits

**Description:**
Systematically identifies all state-changing entry points in the application (API calls, deep links, user inputs, auth events) to create a comprehensive attack surface map.

**Relevance to AURA Health:**
- Deep link scheme `zenova-lifescore://` — attack surface for URL hijacking
- Supabase Edge Function `/functions/v1/ai-coach` — unauthenticated POST endpoint
- Auth state change listener — processes session events from external sources
- AsyncStorage keys — readable by other apps on rooted devices

**When to trigger:**
- At the start of any security audit
- Before penetration testing
- When new routes or screens are added
- When a new Supabase Edge Function is deployed

**Example audit workflow:**
```
1. Map all Linking.addEventListener handlers — document expected URL patterns
2. Map all supabase.auth.onAuthStateChange handlers — document event types handled
3. List all fetch() endpoints called by the app — classify as authenticated vs unauthenticated
4. List all Zustand store mutation functions — identify which are callable without auth
5. Document the attack surface and prioritize highest-risk entry points
```

---

## Installation

To install Trail of Bits skills in Claude Code:

```bash
# Add the Trail of Bits skills marketplace
/plugin marketplace add trailofbits/skills

# Or install individual skills
/plugin install trailofbits/skills/plugins/semgrep-rule-creator
/plugin install trailofbits/skills/plugins/insecure-defaults
/plugin install trailofbits/skills/plugins/supply-chain-risk-auditor
```

## Skill Trigger Matrix

| File Changed | Skills to Run |
|---|---|
| `stores/authStore.ts` | insecure-defaults, differential-review, sharp-edges |
| `stores/subscriptionStore.ts` | insecure-defaults, differential-review, variant-analysis |
| `app/_layout.tsx` | insecure-defaults, sharp-edges, entry-point-analyzer |
| `services/*.ts` | insecure-defaults, sharp-edges, variant-analysis |
| `supabase/functions/**` | insecure-defaults, differential-review |
| `package.json` | supply-chain-risk-auditor |
| `app/(auth)/**` | differential-review, sharp-edges |
| Any new file | insecure-defaults, entry-point-analyzer |
