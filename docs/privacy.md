---
description: Privacy policy for the Vue Privacy documentation site. Information about cookies, Google Analytics usage, and your data rights under GDPR.
---

# Privacy Policy

**Last updated:** October 2026

This site ([privacy.sw.foundation](https://privacy.sw.foundation)) is the documentation site for the open-source **@structured-world/vue-privacy** library, operated by [structured.world](https://structured.world).

## What We Collect

### Analytics (with consent)

When you allow analytics, we use **Google Analytics 4** (GA4) to understand how visitors use our documentation. Until then the site loads nothing from Google and sends it nothing (the library's basic mode); withdrawing switches it off again and deletes its cookies. With your consent, GA4 receives:

- Pages visited and time spent
- Referral source (how you found us)
- Browser type, screen size, and operating system
- Country (approximate, from IP)

**We do not collect** personal information such as names, email addresses, or precise location.

### Consent Preferences

Your consent choice is stored only in your browser, in the `consent_preferences` cookie (365 days), so the site remembers it across visits; no copy is kept on a server. The site does not look up your location: every visitor is asked.

Before October 2026 the site also kept a copy of a grant in a Cloudflare KV store, named by an anonymous `consent_uid` cookie. That store is no longer used, and the site neither reads nor sets `consent_uid`; a copy of the cookie set earlier stays in your browser until it expires (365 days after it was set) or you delete it.

## Cookies Used

| Cookie | Purpose | Duration | Category |
|--------|---------|----------|----------|
| `consent_preferences` | Stores your consent choices, when you made them, and whether you made them where consent is required (no location) | 365 days | Necessary |
| `consent_uid` | Only if set before October 2026: an anonymous ID for the remote copy of a grant, no longer read or set | Up to 365 days from when it was set | Necessary |
| `_ga`, `_ga_*` | Google Analytics tracking | 2 years | Analytics |

## Your Rights

You can:

- **Change preferences** at any time using the cookie settings button
- **Reject all** non-essential cookies — the site works fully without them
- **Clear cookies** in your browser settings

## Third-Party Services

- **GitHub Pages** hosts the site and, like any web host, receives your IP address with each request: [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)
- **Google Analytics**, only after you allow analytics: [Google Privacy Policy](https://policies.google.com/privacy)

## Contact

For privacy questions: [GitHub Issues](https://github.com/structured-world/vue-privacy/issues)

## Open Source

This privacy policy is part of the vue-privacy documentation. The consent implementation itself is open source and [available on GitHub](https://github.com/structured-world/vue-privacy).
