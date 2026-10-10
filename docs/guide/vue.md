---
description: Add GDPR-compliant Google Analytics to Vue 3 apps. Plugin setup, ConsentBanner component, useConsent composable, and Vue Router integration.
---

# Vue 3 Integration Guide

## Plugin Setup

```typescript
import { createApp } from 'vue';
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

const app = createApp(App);

app.use(createConsentPlugin({
  gaId: 'G-XXXXXXXXXX',
  geoDetection: 'auto',
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
| `theme` | `'auto' \| 'light' \| 'dark'` | the manager's `theme`, else `'auto'` | Colour palette |

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
  getConsent,        // () => StoredConsent | null
  isConsentRequired, // () => boolean | null
  hasConsent,        // () => boolean
  acceptAll,         // () => Promise<void>
  rejectAll,         // () => Promise<void>
  resetConsent,      // () => void
  savePreferences    // (categories) => Promise<void>
} = useConsent();
</script>

<template>
  <div v-if="hasConsent()">
    <p>Analytics: {{ getConsent()?.categories.analytics ? 'Yes' : 'No' }}</p>
    <button @click="resetConsent">Manage Cookies</button>
  </div>
</template>
```

## Custom Preferences UI

Build your own preferences modal in place of `ConsentPreferenceModal`. Registered with the manager, it opens for the banner's "Customize", `showPreferenceCenter()` and `requestConsent()`; it loads the current choice when it opens, and shows why a feature asks:

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useConsent } from '@structured-world/vue-privacy/vue';

const { manager, savePreferences, getConsent } = useConsent();

const visible = ref(false);
// What requestConsent() asks for: its categories and reasons, or null
const request = ref(null);
// Offer every category the site uses (`usedCategories`), so a requested one can be granted
const toggles = ref({ analytics: false, marketing: false, functional: false });

onMounted(() => {
  manager.onShowPreferenceCenter(() => {
    request.value = manager.getConsentRequest();
    // A request joining the open dialog only refreshes the request: the visitor's
    // unsaved ticks stay
    if (visible.value) return;
    // The stored choice, else unticked: never the ticks of an earlier, unsaved opening
    const categories = getConsent()?.categories;
    toggles.value = {
      analytics: categories?.analytics ?? false,
      marketing: categories?.marketing ?? false,
      functional: categories?.functional ?? false,
    };
    visible.value = true;
  });
  manager.onHidePreferenceCenter(() => {
    visible.value = false;
    request.value = null;
  });
});

onUnmounted(() => {
  manager.onShowPreferenceCenter(null);
  manager.onHidePreferenceCenter(null);
});

async function save() {
  // Saving answers the pending requests and closes the dialog
  await savePreferences({ ...toggles.value });
}
</script>

<template>
  <div v-if="visible" class="preferences-modal">
    <p v-for="reason in request?.reasons ?? []" :key="reason">{{ reason }}</p>
    <label
      v-for="category in ['analytics', 'marketing', 'functional']"
      :key="category"
      :class="{ requested: request?.categories.includes(category) }"
    >
      <input type="checkbox" v-model="toggles[category]" />
      {{ category }}
    </label>
    <button @click="save">Save Preferences</button>
    <button @click="manager.hidePreferenceCenter()">Close</button>
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
