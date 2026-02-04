# Analytics

vue-privacy provides comprehensive Google Analytics 4 (GA4) integration with automatic consent management.

## GA4 Integration Features

- **Automatic gtag.js loading** with Consent Mode v2 defaults
- **SPA page view tracking** (VitePress, Quasar, Vue Router)
- **Consent-aware tracking** — no data sent without analytics consent
- **Typed ecommerce helpers** — `trackPurchase()`, `trackAddToCart()`, etc.
- **Custom event tracking** — `trackEvent()` for any GA4 event
- **Vue Router integration** — auto-track events from route meta

## Quick Start

```typescript
import { createConsentManager } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
});

await manager.init();

// Track events
manager.trackEvent('button_click', { button_id: 'cta_hero' });
manager.trackSignUp('email');
manager.trackPurchase({ transaction_id: '123', currency: 'USD', value: 99, items: [...] });
```

## Event Tracking Methods

### General Events

```typescript
// Custom event
manager.trackEvent('share', { method: 'twitter', content_type: 'article' });

// Sign up
manager.trackSignUp('google');  // or 'email', 'facebook', etc.

// Login
manager.trackLogin('email');

// Lead generation
manager.trackGenerateLead({ value: 100, currency: 'USD' });
```

### Ecommerce Events

```typescript
// View product
manager.trackViewItem({
  currency: 'USD',
  value: 29.99,
  items: [{ item_id: 'SKU_123', item_name: 'T-Shirt', price: 29.99 }]
});

// Add to cart
manager.trackAddToCart({
  currency: 'USD',
  value: 29.99,
  items: [{ item_id: 'SKU_123', item_name: 'T-Shirt', price: 29.99, quantity: 1 }]
});

// Begin checkout
manager.trackBeginCheckout({
  currency: 'USD',
  value: 29.99,
  items: [...]
});

// Purchase
manager.trackPurchase({
  transaction_id: 'ORDER_123',
  currency: 'USD',
  value: 35.98,
  shipping: 5.99,
  tax: 0,
  items: [...]
});
```

See [Ecommerce Tracking](/guide/ecommerce) for the complete ecommerce guide.

## Vue Router Auto-Tracking

Define events in route meta to fire automatically on navigation:

```typescript
const routes = [
  {
    path: '/signup/complete',
    component: SignupComplete,
    meta: {
      ga4Title: 'Registration Complete',
      ga4Event: { name: 'sign_up', params: { method: 'email' } }
    }
  }
]
```

See [Vue Integration](/guide/vue#vue-router-integration) for setup details.

## Consent & Analytics

All tracking methods automatically check consent state:

| Consent State | Behavior |
|--------------|----------|
| `analytics: true` | Events sent to GA4 |
| `analytics: false` | Events silently dropped |
| No consent yet | Events dropped (EU users) |

This ensures GDPR compliance — no tracking happens without user consent.

## Google Consent Mode v2

vue-privacy automatically configures all 4 Consent Mode v2 signals:

| Signal | Controlled By |
|--------|---------------|
| `analytics_storage` | `analytics` category |
| `ad_storage` | `marketing` category |
| `ad_user_data` | `marketing` category |
| `ad_personalization` | `marketing` category |

See [Google Consent Mode v2](/guide/consent-mode) for details.

## Setting Up Conversions in GA4

After tracking events, mark them as conversions in GA4:

1. Go to **GA4 Admin** → **Events**
2. Find your event (appears after first trigger)
3. Toggle **"Mark as conversion"**

Recommended conversions:
- `purchase` — completed order
- `sign_up` — new registration
- `generate_lead` — contact form submission

## Planned: Privacy-First Analytics

The [Privacy Platform](/guide/platform) will offer a built-in analytics alternative:

- **No PII collection** — page views and events without personal data
- **Consent dashboard** — opt-in rates, banner interaction metrics
- **A/B testing** — test banner variations to optimize consent rates
- **ClickHouse-powered** — fast aggregation for real-time dashboards

These features will be available through the [privacy.structured.world](https://privacy.structured.world) dashboard.
