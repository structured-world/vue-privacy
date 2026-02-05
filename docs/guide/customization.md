---
description: Customize Vue Privacy banner appearance with CSS variables. Configure dark mode, cookie settings, callbacks, and default consent categories.
---

# Customization & Theming

## Banner Text

Override any banner text:

```typescript
createConsentPlugin({
  banner: {
    title: 'Cookie Settings',
    message: 'We use cookies to enhance your browsing experience.',
    acceptAll: 'Accept All Cookies',
    rejectAll: 'Reject Non-Essential',
    customize: 'Manage Preferences',
    privacyLink: '/privacy-policy',
    privacyLinkText: 'Read our Privacy Policy',
  },
});
```

## CSS Custom Properties

Style the banner with CSS variables:

```css
:root {
  /* Background & Text */
  --consent-bg: #ffffff;
  --consent-text: #1a1a1a;
  --consent-text-secondary: #666666;
  --consent-link: #0066cc;

  /* Accept Button */
  --consent-btn-accept-bg: #0066cc;
  --consent-btn-accept-text: #ffffff;

  /* Reject Button */
  --consent-btn-reject-bg: #e0e0e0;
  --consent-btn-reject-text: #1a1a1a;

  /* Typography */
  --consent-font: system-ui, -apple-system, sans-serif;
}
```

### Dark Mode

The banner automatically supports `prefers-color-scheme: dark`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --consent-bg: #1a1a1a;
    --consent-text: #ffffff;
    --consent-text-secondary: #a0a0a0;
    --consent-btn-reject-bg: #333333;
    --consent-btn-reject-text: #ffffff;
  }
}
```

## Cookie Settings

```typescript
createConsentPlugin({
  cookie: {
    name: 'my_consent',      // Cookie name
    expiry: 365,             // Days until expiry
    domain: '.example.com',  // Cookie domain
    path: '/',               // Cookie path
  },
});
```

## Consent Version

Change the version to reset consent for all users:

```typescript
createConsentPlugin({
  version: '2.0', // Changing this clears existing consent
});
```

Useful when:
- Adding new consent categories
- Changing privacy policy
- Legal requirements change

## Callbacks

```typescript
createConsentPlugin({
  onConsentChange: (consent) => {
    console.log('Consent updated:', consent);
    // Sync with your analytics
  },
  onBannerShow: () => {
    console.log('Banner displayed');
  },
  onBannerHide: () => {
    console.log('Banner hidden');
  },
});
```

## Default Categories

```typescript
createConsentPlugin({
  categories: {
    analytics: false,   // Default: denied
    marketing: false,   // Default: denied
    functional: true,   // Default: granted
  },
});
```

The `necessary` category is always `true` and cannot be changed.
