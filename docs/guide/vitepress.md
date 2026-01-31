# Google Analytics for VitePress

Add GDPR-compliant Google Analytics to your VitePress site with one line of code.

## One-Line Setup

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
});
```

That's it. This automatically:

- **Loads `gtag.js`** with Google Consent Mode v2 defaults
- **Detects EU users** and shows a consent banner when required
- **Tracks page views** on every VitePress navigation (SPA-aware)
- **Stores consent** in a cookie for 365 days

## How SPA Tracking Works

VitePress is a single-page app — navigating between pages doesn't trigger a full page reload. Standard Google Analytics misses these navigations.

`enhanceWithConsent` handles this automatically:

1. Sets `send_page_view: false` to prevent duplicate page views on init
2. Tracks the initial page view after the consent manager initializes
3. Watches VitePress router for every navigation
4. Sends `page_view` events with correct `page_path` and `page_title` after DOM updates

You don't need to write any router watching code.

## Custom Theme with Layout Slots

If you need to add components to VitePress layout slots alongside the consent banner:

```typescript
// docs/.vitepress/theme/index.ts
import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { enhanceWithConsent } from '@structured-world/vue-privacy/vitepress';

const consentTheme = enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
});

export default {
  ...consentTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(MyCustomFooter),
    });
  },
} satisfies Theme;
```

## Manual Setup (Advanced)

If you need full control over the consent plugin:

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { createConsentPlugin, ConsentBanner } from '@structured-world/vue-privacy/vue';
import type { Theme } from 'vitepress';
import { h } from 'vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(createConsentPlugin({
      gaId: 'G-XXXXXXXXXX',
      sendPageView: false, // Important: disable for SPA
    }));
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(ConsentBanner),
    });
  },
} satisfies Theme;
```

::: warning SPA Page Tracking
When using manual setup, you'll need to implement your own router watching for SPA page tracking. The `enhanceWithConsent` function does this automatically.
:::

## Configuration

All standard options are supported:

```typescript
enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',         // 'auto' | 'cloudflare' | 'ipapi' | 'timezone'
  banner: {
    title: 'Cookie Preferences',
    message: 'This site uses cookies for analytics.',
    acceptAll: 'Accept',
    rejectAll: 'Decline',
    privacyLink: '/privacy',
  },
  cookie: {
    name: 'docs_consent',
    expiry: 365,
  },
});
```

## Styling

The banner inherits VitePress CSS variables when possible. Override with:

```css
/* docs/.vitepress/theme/custom.css */
:root {
  --consent-bg: var(--vp-c-bg);
  --consent-text: var(--vp-c-text-1);
  --consent-btn-accept-bg: var(--vp-c-brand);
}
```

Import in your theme:

```typescript
import './custom.css';
```
