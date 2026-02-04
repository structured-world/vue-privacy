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

### Auto-tracking with Route Meta

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

### Setup Router Tracking

```typescript
// main.ts
import { createApp } from 'vue';
import { createConsentManager } from '@structured-world/vue-privacy';
import { setupRouterTracking } from '@structured-world/vue-privacy/vue';
import router from './router';
import App from './App.vue';

const app = createApp(App);
const manager = createConsentManager({ gaId: 'G-XXX', sendPageView: false });

app.use(router);

// Setup automatic page and event tracking
setupRouterTracking(router, manager, {
  beforeTrack: (to) => {
    // Skip tracking for admin routes
    if (to.path.startsWith('/admin')) return false;
  },
  afterTrack: (to, eventName) => {
    console.log('Tracked:', to.path, eventName);
  }
});

manager.init();
app.mount('#app');
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
