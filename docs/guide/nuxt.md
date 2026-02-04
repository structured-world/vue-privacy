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

### 3. SPA Page Tracking

Nuxt handles page transitions as SPA navigations. Track them with the `useConsent` composable:

```vue
<!-- app.vue or layouts/default.vue -->
<script setup>
import { useConsent } from '@structured-world/vue-privacy/vue';
import { watch } from 'vue';

const route = useRoute();
const { trackPageView } = useConsent();

// Initial page view is sent automatically by gtag.
// Watch fires only on subsequent navigations.
watch(() => route.path, (path) => {
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

Define events in page meta to fire automatically:

```vue
<!-- pages/signup/complete.vue -->
<script setup>
definePageMeta({
  ga4Title: 'Registration Complete',
  ga4Event: { name: 'sign_up', params: { method: 'email' } }
});
</script>
```

Then watch for route changes with ga4Event:

```vue
<!-- app.vue -->
<script setup>
import { watch } from 'vue';
import { useConsent } from '@structured-world/vue-privacy/vue';

const route = useRoute();
const { trackPageView, trackEvent } = useConsent();

watch(() => route.fullPath, () => {
  const meta = route.meta;
  trackPageView(route.fullPath, meta.ga4Title);

  if (meta.ga4Event) {
    trackEvent(meta.ga4Event.name, meta.ga4Event.params);
  }
});
</script>
```

See [Ecommerce Tracking](/guide/ecommerce) for the full guide.

## Why Not a Nuxt Module?

vue-privacy uses the standard Vue plugin API, which works perfectly with Nuxt 3's `defineNuxtPlugin`. A dedicated Nuxt module would add complexity without significant benefit — the Vue plugin already handles everything including SSR safety (via the `.client.ts` suffix).
