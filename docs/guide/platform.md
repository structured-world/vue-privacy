---
description: Connect Vue Privacy to the managed privacy platform for multi-site consent management, cookie scanning, and compliance analytics.
---

# Privacy Platform Integration

::: warning Coming Soon
The managed privacy platform at [privacy.structured.world](https://privacy.structured.world) is under development. This page will be updated when the platform launches.
:::

## What Is It?

The Privacy Platform is an optional commercial companion to the open-source vue-privacy library. It provides:

- **Multi-site management** — Manage consent across multiple domains from one dashboard
- **Cookie scanner** — Auto-detect and categorize cookies on your site
- **Consent analytics** — Track opt-in rates, banner interactions, and A/B test results
- **Compliance reports** — Export consent records for audits
- **Team access** — Invite team members with role-based permissions
- **Custom branding** — Configure banner appearance per domain via dashboard

## How It Connects

The vue-privacy library works completely standalone with local cookie storage. The platform adds optional remote features via a `siteId` configuration:

```typescript
createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  siteId: 'site_abc123', // From privacy.structured.world dashboard
});
```

## Self-Hosted Alternative

For teams that want remote consent storage without the managed platform, use the open-source [vue-privacy-worker](https://github.com/structured-world/vue-privacy-worker) with the `ConsentStorage` interface:

```typescript
import { createConsentManager, createKVStorage } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  storage: createKVStorage('https://your-worker.your-domain.com/api/consent'),
});
```
