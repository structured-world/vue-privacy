---
description: Block third-party scripts until user consent. Prevent Facebook Pixel, Hotjar, and other tracking scripts from loading before GDPR approval.
---

# Third-Party Script Blocking

Block third-party scripts from executing until the user grants consent for the matching category.

## How It Works

1. Mark scripts with `type="text/plain"` and a `data-consent-category` attribute
2. The browser ignores `type="text/plain"` scripts (they don't execute)
3. When the user grants consent, vue-privacy replaces them with executable copies

## Usage

### Marking Scripts

Change your third-party script tags:

```html
<!-- Before: executes immediately -->
<script src="https://example.com/analytics.js"></script>

<!-- After: blocked until analytics consent -->
<script type="text/plain" data-consent-category="analytics"
        src="https://example.com/analytics.js"></script>
```

### Inline Scripts

Inline scripts work the same way:

```html
<script type="text/plain" data-consent-category="marketing">
  // This code runs only after marketing consent
  fbq('init', '1234567890');
  fbq('track', 'PageView');
</script>
```

### Categories

Use any of the built-in categories:

| Category | Use for |
|----------|---------|
| `analytics` | Google Analytics, Hotjar, Mixpanel |
| `marketing` | Facebook Pixel, Google Ads, TikTok |
| `functional` | Chat widgets, preferences, A/B testing |

## Automatic Integration

When using `ConsentManager`, script blocking is enabled automatically:

```typescript
const manager = createConsentManager({ gaId: 'G-XXX' });
await manager.init();
// Script blocking is active — scripts unblock when consent changes
```

A `MutationObserver` watches for dynamically added blocked scripts and unblocks them if consent has already been granted.

### Cleanup

Call `destroy()` when unmounting your app to disconnect the observer:

```typescript
manager.destroy();
```

## Manual API (UMD/CDN)

For non-Vue usage without `ConsentManager`:

```html
<script src="https://unpkg.com/@structured-world/vue-privacy"></script>
<script>
  // Manually unblock specific categories
  VuePrivacy.unblockScriptsByCategory({
    analytics: true,
    marketing: false,
    functional: true,
  });
</script>
```

## Preserving Script Type

If the original script had a specific `type` (e.g., `module`), store it in `data-script-type`:

```html
<script type="text/plain" data-consent-category="analytics"
        data-script-type="module"
        src="https://example.com/modern-analytics.js"></script>
```

When unblocked, the script's `type` will be restored to `module`.

## How Duplicate Execution Is Prevented

Each script is marked with `data-consent-processed` after being unblocked. If `unblockScriptsByCategory` is called multiple times, processed scripts are skipped.
