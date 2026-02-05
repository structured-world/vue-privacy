# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainers
3. Or use [GitHub's private vulnerability reporting](https://github.com/structured-world/vue-privacy/security/advisories/new)

We will respond within 48 hours and work with you to understand and address the issue.

## Known Vulnerabilities

### CVE-2026-0775 (npm CLI) - Won't Fix Upstream

| Field | Value |
|-------|-------|
| Status | **Won't fix** - vendor declined remediation |
| Severity | High (CVSS 7.0) |
| Package | `npm` (transitive via `@semantic-release/npm`) |
| Impact | Development only - not in production bundle |
| Tracking | [#87](https://github.com/structured-world/vue-privacy/issues/87) |

**Root cause:** Insecure module loading - npm loads modules from unsecured locations.

**Vendor response:** npm maintainers [declined to fix](https://www.zerodayinitiative.com/advisories/ZDI-26-043/), claiming the behavior is "by design". ZDI published as 0-day on 2026-01-12 after vendor refusal.

**Risk assessment:** This is a development dependency used only for CI/CD publishing. Exploitation requires:
1. Local code execution on target machine
2. Ability to place malicious modules in npm's search path
3. User to run npm commands

Production users are **not affected** - this package is not in the production bundle.

**Action:** Dependabot alert dismissed as tolerable risk. No patch expected from upstream.
