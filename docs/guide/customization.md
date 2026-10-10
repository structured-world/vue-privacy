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

  /* Reject Button: unset by default, so it takes the accept colours */
  /* --consent-btn-reject-bg: ...; */
  /* --consent-btn-reject-text: ...; */

  /* Typography */
  --consent-font: system-ui, -apple-system, sans-serif;
}
```

### Dark Mode

The banner and the preference centre follow the system's colour scheme (`prefers-color-scheme`) by default. A site whose design is light only, or dark only, pins the palette with `theme`:

```typescript
createConsentPlugin({
  theme: 'light', // 'auto' (default) | 'light' | 'dark'
});
```

`'light'` keeps the light palette for visitors in dark mode, and `'dark'` shows the dark one on a light system. A component's own `theme` outranks the config: `<ConsentBanner theme="dark" />`, `<ConsentPreferenceModal theme="dark" />`, or `createBanner({ manager, theme: 'dark' })` in vanilla JS.

### Equal prominence for refusing

"Accept all" and "Reject all" share one style by default (same size, weight and colours): the EDPB Cookie Banner Taskforce report (January 2023, points 9-14) and the CNIL guidance treat a refusal that is less visible than an acceptance as a deceptive design. Setting `--consent-btn-reject-bg` and `--consent-btn-reject-text` gives the reject button colours of its own; keep its contrast equal to the accept button's.

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

## Categories Start Unticked

A visitor who has not chosen finds every optional category (`analytics`, `marketing`, `functional`) unticked in the preference centre, and only the visitor's own tick grants one: a pre-ticked box the visitor has to untick to refuse is not valid consent (CJEU, Planet49, C-673/17; GDPR Recital 32). There is no setting to pre-tick a category, and `savePreferences()` refuses a category it is not given.

The `necessary` category is always `true` and cannot be changed. Storage the visitor explicitly asked for, such as the language they picked, is exempt from consent (ePrivacy Directive, Art. 5(3)) and belongs there, not in `functional`.
