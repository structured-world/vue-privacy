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

### CVE-2026-0775 (npm CLI) - Tracked

| Field | Value |
|-------|-------|
| Status | **Monitoring** - no patch available |
| Severity | High (CVSS 7.0) |
| Package | `npm@<=11.8.0` (transitive via `@semantic-release/npm`) |
| Impact | Development only - not in production bundle |
| Tracking | [#87](https://github.com/structured-world/vue-privacy/issues/87) |

**Risk assessment:** This is a development dependency used only for CI/CD publishing. The vulnerability requires local code execution to exploit. Production users are not affected.

**Action:** Dependabot alert dismissed as tolerable risk. Will update when npm releases a patch.
