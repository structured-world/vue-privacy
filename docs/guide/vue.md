# Vue 3 Integration

## Plugin Setup

```typescript
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  euDetection: 'auto',
  banner: {
    title: 'Cookie Settings',
    message: 'We use cookies to improve your experience.',
  },
  onConsentChange: (consent) => {
    console.log('Consent updated:', consent);
  },
}));
```

## ConsentBanner Component

```vue
<script setup>
import { ConsentBanner } from '@structured-world/vue-privacy/vue';
</script>

<template>
  <ConsentBanner
    position="bottom"
    :config="{ title: 'Custom Title' }"
    @accept="onAccept"
    @reject="onReject"
    @customize="onCustomize"
  />
</template>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `'bottom' \| 'top' \| 'center'` | `'bottom'` | Banner position |
| `config` | `Partial<BannerConfig>` | `{}` | Override banner text |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `accept` | - | User clicked Accept All |
| `reject` | - | User clicked Reject All |
| `customize` | - | User clicked Customize |

## useConsent Composable

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const {
  consent,        // Ref<StoredConsent | null>
  isEU,           // Ref<boolean>
  hasConsent,     // Ref<boolean>
  acceptAll,      // () => Promise<void>
  rejectAll,      // () => Promise<void>
  resetConsent,   // () => void
  savePreferences // (categories) => Promise<void>
} = useConsent();
</script>

<template>
  <div v-if="hasConsent">
    <p>Analytics: {{ consent?.categories.analytics ? 'Yes' : 'No' }}</p>
    <button @click="resetConsent">Manage Cookies</button>
  </div>
</template>
```

## Custom Preferences UI

Build your own preferences modal:

```vue
<script setup>
import { ref } from 'vue';
import { useConsent } from '@structured-world/vue-privacy/vue';

const { savePreferences, consent } = useConsent();

const analytics = ref(consent.value?.categories.analytics ?? false);
const marketing = ref(consent.value?.categories.marketing ?? false);

async function save() {
  await savePreferences({
    analytics: analytics.value,
    marketing: marketing.value,
    functional: true,
  });
}
</script>

<template>
  <div class="preferences-modal">
    <label>
      <input type="checkbox" v-model="analytics" />
      Analytics Cookies
    </label>
    <label>
      <input type="checkbox" v-model="marketing" />
      Marketing Cookies
    </label>
    <button @click="save">Save Preferences</button>
  </div>
</template>
```

## Event Tracking

Track custom events, conversions, and ecommerce:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const {
  trackEvent,
  trackPurchase,
  trackAddToCart,
  trackSignUp,
  trackGenerateLead,
} = useConsent();

// Generic event
function onShare() {
  trackEvent('share', { method: 'twitter', content_type: 'article' });
}

// Ecommerce event
function onAddToCart(product) {
  trackAddToCart({
    currency: 'USD',
    value: product.price,
    items: [{ item_id: product.sku, item_name: product.name, price: product.price }]
  });
}

// Conversion event
function onPurchase(order) {
  trackPurchase({
    transaction_id: order.id,
    currency: 'USD',
    value: order.total,
    items: order.items.map(i => ({
      item_id: i.sku,
      item_name: i.name,
      price: i.price,
      quantity: i.qty,
    }))
  });
}
</script>
```

See [Ecommerce Tracking](/guide/ecommerce) for the full guide.

## Vue Router Integration

### Automatic Tracking (Recommended)

Pass `router` to the plugin for automatic page view and event tracking:

```typescript
// main.ts
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';
import router from './router';
import App from './App.vue';

const app = createApp(App);

app.use(router);
app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  router: router,  // Enables automatic SPA tracking
}));

app.mount('#app');
```

That's it! The plugin will automatically:
- Track `page_view` on every navigation
- Fire `ga4Event` from route meta
- Use `ga4Title` as custom page title

### Route Meta for Events

Define `ga4Event` in route meta to fire events automatically on navigation:

```typescript
// router/index.ts
const routes = [
  {
    path: '/signup/complete',
    component: SignupComplete,
    meta: {
      ga4Title: 'Registration Complete',  // Custom page title
      ga4Event: { name: 'sign_up', params: { method: 'email' } }
    }
  }
]
```

### Middleware Options

Filter routes or add callbacks:

```typescript
app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  router: router,
  routerMiddleware: {
    beforeTrack: (to) => {
      // Skip tracking for admin routes
      if (to.path.startsWith('/admin')) return false;
    },
    afterTrack: (to, eventName) => {
      console.log('Tracked:', to.path, eventName);
    }
  }
}));
```

#### Skip Initial Page View

To skip tracking the initial page load (e.g., for custom analytics logic), use `beforeTrack`:

```typescript
routerMiddleware: {
  beforeTrack: (to, from) => {
    // Initial navigation: to === from (same route object)
    if (to === from) return false;
    return true;
  }
}
```

This lets you handle the initial page view manually:

```typescript
// After some async logic (auth, A/B test, etc.)
const { trackPageView } = useConsent();
trackPageView(route.path, 'Custom Title');
```

### Manual Setup (Advanced)

For more control, use `setupRouterTracking` directly:

```typescript
import { createApp } from 'vue';
import { createConsentManager } from '@structured-world/vue-privacy';
import { setupRouterTracking } from '@structured-world/vue-privacy/vue';
import router from './router';

const app = createApp(App);
const manager = createConsentManager({ gaId: 'G-XXX', sendPageView: false });

app.use(router);

async function bootstrap() {
  await manager.init();
  setupRouterTracking(router, manager);
  app.mount('#app');
}

bootstrap();
```

### TypeScript Support

Import types for route meta:

```typescript
import '@structured-world/vue-privacy/vue';

// Now TypeScript knows about ga4Title and ga4Event
const routes = [
  {
    path: '/',
    meta: {
      ga4Title: 'Home',           // ✓ TypeScript knows this
      ga4Event: { name: 'home' }  // ✓ And this
    }
  }
]
```
