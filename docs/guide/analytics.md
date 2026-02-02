# Analytics

::: warning Coming Soon
Privacy-first analytics is planned as part of the [Privacy Platform](/guide/platform). This page will be updated when the feature launches.
:::

## Current Analytics Support

vue-privacy integrates with **Google Analytics 4** (GA4) out of the box:

- Automatic `gtag.js` loading with Consent Mode v2 defaults
- SPA page view tracking (VitePress, Quasar, Vue Router)
- Consent-aware tracking (no data sent without analytics consent)

See [Google Consent Mode v2](/guide/consent-mode) for details.

## Planned: Privacy-First Analytics

The Privacy Platform will offer a built-in analytics alternative:

- **No PII collection** — Page views and events without personal data
- **Consent dashboard** — Opt-in rates, banner interaction metrics
- **A/B testing** — Test banner variations to optimize consent rates
- **ClickHouse-powered** — Fast aggregation for real-time dashboards

These features will be available through the [privacy.structured.world](https://privacy.structured.world) dashboard.
