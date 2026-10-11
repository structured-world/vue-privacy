---
description: Add a GDPR cookie consent banner and Google Analytics 4 to Nuxt 4 and Nuxt 3 apps. Client plugin, measurement ID from runtime config, ConsentBanner component, SPA page tracking and route meta events.
---

# Nuxt Integration Guide

vue-privacy works with Nuxt 4 and Nuxt 3 through the standard Vue plugin system: no Nuxt module is needed.

## Setup

### 1. Create a Client Plugin

```typescript
// app/plugins/consent.client.ts (Nuxt 3 without the app/ directory: plugins/consent.client.ts)
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX', // Your GA4 measurement ID
    geoDetection: 'auto',
  }));
});
```

::: tip Client-only
The `.client.ts` suffix runs the plugin in the browser only, so server rendering never touches cookies or the consent state.
:::

### Measurement ID from Runtime Config

To set the ID per environment (`NUXT_PUBLIC_GA_ID`), read it from the runtime config. `consentMode: 'basic'` requires `gaId` (the constructor throws without it), so pass both only when an ID is set; without one the banner still runs, which keeps the consent flow testable on preview builds:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: { gaId: '' },
  },
});
```

```typescript
// app/plugins/consent.client.ts
import { createConsentPlugin } from '@structured-world/vue-privacy/vue';

export default defineNuxtPlugin((nuxtApp) => {
  const { gaId } = useRuntimeConfig().public;
  nuxtApp.vueApp.use(createConsentPlugin({
    ...(gaId ? { gaId, consentMode: 'basic' as const } : {}),
    router: nuxtApp.$router,
  }));
});
```

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
// app/plugins/consent.client.ts
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
// app/plugins/consent.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createConsentPlugin({
    gaId: 'G-XXXXXXXXXX',
    geoDetection: 'auto',
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

Track custom events, conversions, and ecommerce in your components. Call `useConsent()` in `<script setup>` and use what it returns in handlers: like any composable built on `inject()`, it works only during setup, and inside a click handler it throws.

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

vue-privacy uses the standard Vue plugin API, which Nuxt's `defineNuxtPlugin` loads as is. A dedicated Nuxt module would add a layer without adding anything: the client plugin already keeps the consent code out of server rendering (the `.client.ts` suffix).
