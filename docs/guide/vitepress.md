# VitePress Integration

## Theme Enhancement

The easiest way to add consent to VitePress:

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { enhanceWithConsent } from '@structured-world/consent/vitepress';

export default enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
  banner: {
    position: 'bottom',
  },
});
```

This automatically:
- Installs the Vue plugin
- Adds the ConsentBanner component
- Initializes Google Analytics with Consent Mode

## Custom Theme

If you have a custom theme:

```typescript
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme';
import { createConsentPlugin, ConsentBanner } from '@structured-world/consent/vue';
import type { Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(createConsentPlugin({
      gaId: 'G-XXXXXXXXXX',
    }));
  },
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(ConsentBanner),
    });
  },
} satisfies Theme;
```

## Configuration

All standard options are supported:

```typescript
enhanceWithConsent(DefaultTheme, {
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
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
