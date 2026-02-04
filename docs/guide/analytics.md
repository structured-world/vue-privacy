# Analytics

vue-privacy provides comprehensive Google Analytics 4 (GA4) integration with automatic consent management.

## GA4 Integration Features

- **Automatic gtag.js loading** with Consent Mode v2 defaults
- **SPA page view tracking** (VitePress, Quasar, Vue Router)
- **Consent-aware tracking** — uses Consent Mode v2; analytics cookies and full measurement start only after consent
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

Tracking methods check consent state and work with Consent Mode v2:

| Consent State | Behavior |
|--------------|----------|
| `analytics: true` | Full GA4 tracking with cookies |
| `analytics: false` | Events silently dropped by vue-privacy |
| No consent yet (EU) | Events sent under Consent Mode defaults (cookieless pings, no storage) |
| No consent yet (non-EU) | Auto-granted, full tracking |

Consent Mode v2 allows GA to receive cookieless pings before user choice, enabling modeled conversions while remaining GDPR-compliant.

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

## Consent Analytics

Track how users interact with your consent banner. Events are sent to your analytics endpoint (fire-and-forget, no blocking).

### Setup

```typescript
import { createConsentManager, createKVStorage } from '@structured-world/vue-privacy';

const manager = createConsentManager({
  gaId: 'G-XXXXXXXXXX',
  storage: createKVStorage('/api/consent'),
  analyticsUrl: '/api/analytics',  // Consent analytics endpoint
});

await manager.init();
```

### Events Tracked

| Event | When | Data |
|-------|------|------|
| `banner_shown` | Banner displayed to user | `isEU`, `timestamp` |
| `consent_given` | User accepts/rejects for first time | `categories`, `timeToDecision`, `source` |
| `consent_updated` | User changes existing preferences | `categories`, `timeToDecision`, `source` |

### Event Payload

```typescript
interface ConsentAnalyticsEvent {
  event: 'banner_shown' | 'consent_given' | 'consent_updated';
  timestamp: string;              // ISO 8601
  categories?: {                  // Only for consent events
    analytics: boolean;
    marketing: boolean;
    functional: boolean;
  };
  timeToDecision?: number;        // Milliseconds from banner to action
  source?: 'banner' | 'preference_center';
  isEU?: boolean;
}
```

### Time-to-Decision Tracking

Measures how long users take to make a consent decision:

```typescript
// timeToDecision = Date.now() - bannerShownAt
// Typical values: 2000-10000ms for engaged users
```

This metric helps optimize your banner UX:
- **< 2s**: Users clicking quickly (may not read)
- **2-10s**: Engaged users making informed choice
- **> 30s**: Banner may be confusing or intrusive

### Source Tracking

Tracks where consent actions originate:

- `banner` — User clicked Accept/Reject on the main banner
- `preference_center` — User saved preferences via the modal

### Privacy Guarantees

- **No PII sent** — Only consent categories and timing
- **No cookies for analytics** — Uses fire-and-forget POST
- **Silent failures** — Network errors don't affect consent flow
- **EU status only** — No IP addresses or fingerprints

### Backend Implementation

Use [vue-privacy-worker](https://github.com/structured-world/vue-privacy-worker) for a ready-made Cloudflare Worker backend, or implement your own endpoint:

```typescript
// Your backend POST /api/analytics
app.post('/api/analytics', (req, res) => {
  const { event, timestamp, categories, timeToDecision, source, isEU } = req.body;

  // Store in your analytics system
  analytics.track(event, {
    timestamp,
    categories,
    timeToDecision,
    source,
    isEU,
  });

  res.status(200).send('ok');
});
```

## Planned: Privacy-First Analytics

The [Privacy Platform](/guide/platform) will offer a built-in analytics alternative:

- **No PII collection** — page views and events without personal data
- **Consent dashboard** — opt-in rates, banner interaction metrics
- **A/B testing** — test banner variations to optimize consent rates
- **ClickHouse-powered** — fast aggregation for real-time dashboards

These features will be available through the [privacy.structured.world](https://privacy.structured.world) dashboard.
