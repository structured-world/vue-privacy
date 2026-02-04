# Nuxt 3

vue-privacy works with Nuxt 3 via the standard Vue plugin system.

## Setup

### 1. Create a Client Plugin

```typescript
// plugins/consent.client.ts
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
    euDetection: 'auto',
  }));
});
```

::: tip Client-only
The `.client.ts` suffix ensures this plugin only runs in the browser — no SSR issues.
:::

### 2. Add the Banner

```vue
<!-- layouts/default.vue or app.vue -->
<script setup>
import { ConsentBanner } from '@structured-world/vue-privacy/vue';
</script>

<template>
  <div>
    <NuxtPage />
    <ConsentBanner />
  </div>
</template>
```

### 3. SPA Page Tracking (Recommended)

Pass the router to the plugin for automatic tracking:

```typescript
// plugins/consent.client.ts
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX',
    router: nuxtApp.$router,  // Automatic SPA tracking
  }));
});
```

This automatically tracks all page views and fires `ga4Event` from route meta.

### Manual Tracking (Alternative)

If you need custom tracking logic, use the composable with watch:

```vue
<!-- app.vue or layouts/default.vue -->
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';
import { watch } from 'vue';

const route = useRoute();
const { trackPageView } = useConsent();

// Track navigations (skip first watch callback where oldPath is undefined)
watch(() => route.path, (path, oldPath) => {
  // oldPath is undefined on first watch trigger — skip to avoid double-tracking
  if (!oldPath) return;
  trackPageView(path);
});
</script>
```

## Configuration

All standard options are supported:

```typescript
// plugins/consent.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX',
    euDetection: 'auto',
    banner: {
      title: 'Cookie Preferences',
      message: 'This site uses cookies for analytics.',
      acceptAll: 'Accept',
      rejectAll: 'Decline',
    },
    cookie: {
      name: 'my_consent',
      expiry: 365,
    },
  }));
});
```

## Event Tracking

Track custom events, conversions, and ecommerce in your components:

```vue
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';

const {
  trackEvent,
  trackPurchase,
  trackAddToCart,
  trackSignUp,
} = useConsent();

// Add to cart
function onAddToCart(product) {
  trackAddToCart({
    currency: 'USD',
    value: product.price,
    items: [{ item_id: product.sku, item_name: product.name, price: product.price }]
  });
}

// Complete purchase
async function onCheckout(order) {
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

### Route Meta Events

Define events in page meta to fire automatically when using the router option:

```vue
<!-- pages/signup/complete.vue -->
<script setup>
definePageMeta({
  ga4Title: 'Registration Complete',
  ga4Event: { name: 'sign_up', params: { method: 'email' } }
});
</script>
```

Events fire automatically when the user navigates to these pages (no extra code needed if using `router: nuxtApp.$router`).

See [Ecommerce Tracking](/guide/ecommerce) for the full guide.

## Why Not a Nuxt Module?

vue-privacy uses the standard Vue plugin API, which works perfectly with Nuxt 3's `defineNuxtPlugin`. A dedicated Nuxt module would add complexity without significant benefit — the Vue plugin already handles everything including SSR safety (via the `.client.ts` suffix).
